from __future__ import division

import argparse
import collections
import json
import fnmatch
import os

# TODO(rchengyue): Restructure project. Create scripts folder with tests inside. Write tests.
# TODO(rchengyue): Separate calculator and computing positives/negatives into classes.

CarDetectionDataFilenames = collections.namedtuple(
    'CarDetectionDataFilenames',
    ['ground_truth_data_filename', 'prediction_data_filename'])

PrecisionAndRecall = collections.namedtuple(
    'PrecisionAndRecall',
    ['precision', 'recall'])

class CommonEqualityMixin(object):

    def __eq__(self, other):
        return (isinstance(other, self.__class__)
            and self.__dict__ == other.__dict__)

    def __ne__(self, other):
        return not self.__eq__(other)

class Box(CommonEqualityMixin):

    def __init__(self, box):
        self.__width = box[2]
        self.__height = box[3]
        self.__x1 = box[0]
        self.__y1 = box[1]
        self.__x2 = self.__x1 + self.__width
        self.__y2 = self.__y1 + self.__height
        self.__area = self.__width * self.__height

    @property
    def x1(self):
        return self.__x1

    @property
    def y1(self):
        return self.__y1

    @property
    def x2(self):
        return self.__x2

    @property
    def y2(self):
        return self.__y2

    @property
    def width(self):
        return self.__width

    @property
    def height(self):
        return self.__height

    @property
    def area(self):
        return self.__area

    def is_overlapping(self, box):
        return self.__is_point_in_box(self.x1, self.y2, box) \
            or self.__is_point_in_box(self.x2, self.y1, box) \
            or self.__is_point_in_box(self.x1, self.y2, box) \
            or self.__is_point_in_box(self.x2, self.y2, box)

    def __is_point_in_box(self, x, y, box):
        return not (x < box.x1 or x > box.x2 or y < box.y1 or y > box.y2)

    def intersect_area(self, other_box):
        return max(0, (min(self.x2, other_box.x2) - max(self.x1, other_box.x1))) * \
            max(0, (min(self.y2, other_box.y2) - max(self.y1, other_box.y1)))

    def union_area(self, other_box):
        return self.area + other_box.area - self.intersect_area(other_box)

class CarDetectionPrecisionAndRecall():
    """Calculates the precision and recall based on the
    given prediction and ground truth data.
    """

    ground_truth_frame_count_multiplier = 4
    overlapped_area_ratio_threshold = 0.3
    overall_precision_and_recall_decimal_places = 4

    def __init__(self, car_detection_data_filenames):
        self.__ground_truth_data = \
            self.__get_json_data(car_detection_data_filenames.ground_truth_data_filename)
        self.__prediction_data = \
            self.__get_json_data(car_detection_data_filenames.prediction_data_filename)

    def __get_json_data(self, filename):
        try:
            with open(filename, 'rb') as f:
                return json.load(f)
        except Exception as e:
            print(e)

    def precision_and_recall(self):
        total_precision = 0
        total_recall = 0
        total_frames = len(self.__prediction_data)
        for frame_count in range(total_frames):
            ground_truth_frame_count = \
                frame_count * CarDetectionPrecisionAndRecall.ground_truth_frame_count_multiplier
            # Make sure ground truth frame count is within ground truth data length
            if (ground_truth_frame_count > len(self.__ground_truth_data)):
                break
            ground_truth_frame_data = self.__ground_truth_data[ground_truth_frame_count]
            prediction_frame_data = self.__prediction_data[frame_count]
            frame_precision, frame_recall = \
                self.__frame_precision_and_recall(ground_truth_frame_data, prediction_frame_data)
            total_precision += frame_precision
            total_recall += frame_recall
        overall_precision = round(
            total_precision / total_frames,
            CarDetectionPrecisionAndRecall.overall_precision_and_recall_decimal_places)
        overall_recall = round(
            total_recall / total_frames,
            CarDetectionPrecisionAndRecall.overall_precision_and_recall_decimal_places)
        return PrecisionAndRecall(overall_precision, overall_recall)

    def __frame_precision_and_recall(self, ground_truth_frame_data, prediction_frame_data):
        prediction_boxes_count = len(prediction_frame_data)
        ground_truth_boxes_count = len(ground_truth_frame_data)
        frame_precision = 0
        frame_recall = 0
        if prediction_boxes_count == 0 and ground_truth_boxes_count == 0:
            frame_precision = 1
            frame_recall = 1
        elif prediction_boxes_count == 0 and ground_truth_boxes_count > 0:
            frame_precision = 1
        elif prediction_boxes_count > 0 and ground_truth_boxes_count == 0:
            frame_recall = 1
        else:
            overlapped_boxes_count = \
                self.__overlapped_box_count(ground_truth_frame_data, prediction_frame_data)
            frame_precision = overlapped_boxes_count / len(prediction_frame_data)
            frame_recall = overlapped_boxes_count / len(ground_truth_frame_data)
        return PrecisionAndRecall(frame_precision, frame_recall)

    def __overlapped_box_count(self, ground_truth_frame_data, prediction_frame_data):
        total_overlapped_boxes = 0
        seen_ground_truth_boxes = set()
        for prediction_frame_data_box in prediction_frame_data:
            for ground_truth_frame_data_box in ground_truth_frame_data:
                ground_truth_box = Box(ground_truth_frame_data_box['rect'])
                prediction_box = Box(prediction_frame_data_box['rect'])
                # Making sure that ground truth boxes are not double counted by prediction boxes
                if ground_truth_box not in seen_ground_truth_boxes:
                    intersect_area = prediction_box.intersect_area(ground_truth_box)
                    union_area = prediction_box.union_area(ground_truth_box)
                    overlapped_area_ratio = intersect_area / union_area
                    if (overlapped_area_ratio > CarDetectionPrecisionAndRecall.overlapped_area_ratio_threshold):
                        total_overlapped_boxes += 1
                        seen_ground_truth_boxes.add(ground_truth_box)
        return total_overlapped_boxes

class CarDetectionDataFilenamesFinder():
    """Finds all the prediction and ground truth filenames to compute precision and recall."""

    ground_truth_data_filename = 'bbs-cam2-verified.json'
    prediction_data_filename = 'bbs-cam2.json'

    def __init__(self, base_path):
        self.__base_path = base_path

    def data_filenames(self):
        print('Finding all the data files to compute precision and recall...')
        car_detection_data = {}
        for root, dirnames, filenames in os.walk(self.__base_path):
            for filename in fnmatch.filter(filenames, CarDetectionDataFilenamesFinder.ground_truth_data_filename):
                ground_truth_data_filename = \
                    '/'.join([root, CarDetectionDataFilenamesFinder.ground_truth_data_filename])
                prediction_data_filename = \
                    '/'.join([root, CarDetectionDataFilenamesFinder.prediction_data_filename])
                print('Found ground truth data: ' + ground_truth_data_filename)
                print('Found prediction data: ' + prediction_data_filename)
                car_detection_data[root] = \
                    CarDetectionDataFilenames(ground_truth_data_filename, prediction_data_filename)
        return car_detection_data

def get_args_parser():
    parser = argparse.ArgumentParser(
        description='Writes precision and recall of car detection files based on given base path')
    parser.add_argument(
        '-b',
        '--base_path',
        action='store',
        dest='base_path',
        required=True,
        help='Base path from which to compute precision and recall recursively')
    parser.add_argument(
        '-f',
        '--output_file',
        action='store',
        dest='output_file',
        required=False,
        default='public/precision_and_recall.json',
        help='Output file to write out the precision and recall for runs')
    return parser

def main():
    """
    Example command:
    python public/files/precision_recall.py -b public/runs -f public/precision_and_recall.json
    """
    parser = get_args_parser()
    args = parser.parse_args()
    # TODO(rchengyue): Make run name prefix removal based on current directory.
    run_name_prefix = 'public/runs/'
    if args.base_path and args.output_file:
        car_detection_data_filenames_finder = CarDetectionDataFilenamesFinder(args.base_path)
        car_detection_data = car_detection_data_filenames_finder.data_filenames()
        precision_recalls = {}
        for run, data in car_detection_data.iteritems():
            print('Computing precision and recall for: ' + run)
            precision_recall = CarDetectionPrecisionAndRecall(data)
            precision, recall = precision_recall.precision_and_recall()
            print('Precision for run: ' + run + ' is: ' + str(precision))
            print('Recall for run: ' + run + ' is: ' + str(recall))
            precision_recalls[run.replace(run_name_prefix, '')] = {'precision': precision, 'recall': recall}
        print('Writing precision and recalls out to: ' + args.output_file)
        with open(args.output_file, 'w') as f:
            json.dump(precision_recalls, f)

if __name__ == '__main__':
    main()



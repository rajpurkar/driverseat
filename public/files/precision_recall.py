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

class Rectangle():

    def __init__(self, rectangle):
        self.__width = rectangle[2]
        self.__height = rectangle[3]
        self.__x1 = rectangle[0]
        self.__y1 = rectangle[1]
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

    def is_overlapping(self, rectangle):
        return self.__is_point_in_rect(self.x1, self.y2, rectangle) \
            or self.__is_point_in_rect(self.x2, self.y1, rectangle) \
            or self.__is_point_in_rect(self.x1, self.y2, rectangle) \
            or self.__is_point_in_rect(self.x2, self.y2, rectangle)

    def __is_point_in_rect(self, x, y, rect):
        return not (x < rect.x1 or x > rect.x2 or y < rect.y1 or y > rect.y2)

    def intersect_area(self, other_rectangle):
        return max(0, (min(self.x2, other_rectangle.x2) - max(self.x1, other_rectangle.x1))) * \
            max(0, (min(self.y2, other_rectangle.y2) - max(self.y1, other_rectangle.y1)))

    def union_area(self, other_rectangle):
        return self.area + other_rectangle.area - self.intersect_area(other_rectangle)

class CarDetectionPrecisionRecall():
    """Calculates the precision and recall based on the
    given prediction and ground truth data.
    """

    ground_truth_frame_count_multiplier = 4
    overlapped_area_ratio_threshold = 0.3

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

    def get_precision_and_recall(self):
        total_precision = 0
        total_recall = 0
        total_frames = len(self.__prediction_data)
        for frame_count in range(total_frames):
            ground_truth_frame_count = \
                frame_count * CarDetectionPrecisionRecall.ground_truth_frame_count_multiplier
            # Make sure ground truth frame count is within ground truth data length
            if (ground_truth_frame_count > len(self.__ground_truth_data)):
                break
            ground_truth_frame_data = self.__ground_truth_data[ground_truth_frame_count]
            prediction_frame_data = self.__prediction_data[frame_count]
            overlapped_boxes_count = \
                self.__overlapped_box_count(ground_truth_frame_data, prediction_frame_data)
            total_precision += overlapped_boxes_count / len(prediction_frame_data)
            total_recall += overlapped_boxes_count / len(ground_truth_frame_data)
        overall_precision = total_precision / total_frames
        overall_recall = total_recall / total_frames
        return PrecisionAndRecall(overall_precision, overall_recall)

    def __overlapped_box_count(self, ground_truth_frame_data, prediction_frame_data):
        total_overlapped_boxes = 0
        for prediction_frame_data_box in prediction_frame_data:
            for ground_truth_frame_data_box in ground_truth_frame_data:
                ground_truth_rectangle = Rectangle(ground_truth_frame_data_box['rect'])
                prediction_rectangle = Rectangle(prediction_frame_data_box['rect'])
                if (prediction_rectangle.is_overlapping(ground_truth_rectangle)):
                    intersect_area = prediction_rectangle.intersect_area(ground_truth_rectangle)
                    union_area = prediction_rectangle.union_area(ground_truth_rectangle)
                    overlapped_area_ratio = intersect_area / union_area
                    if (overlapped_area_ratio > CarDetectionPrecisionRecall.overlapped_area_ratio_threshold):
                        total_overlapped_boxes += 1
        return total_overlapped_boxes

class CarDetectionDataFilenamesFinder():
    """Finds all the prediction and ground truth filenames to compute precision and recall."""

    ground_truth_data_filename = 'bbs-cam2-verified.json'
    prediction_data_filename = 'bbs-cam2.json'

    def __init__(self, base_path):
        self.__base_path = base_path

    def data_filenames(self):
        print("Finding all the data files to compute precision and recall...")
        car_detection_data = {}
        for root, dirnames, filenames in os.walk(self.__base_path):
            for filename in fnmatch.filter(filenames, CarDetectionDataFilenamesFinder.ground_truth_data_filename):
                ground_truth_data_filename = \
                    '/'.join([root, CarDetectionDataFilenamesFinder.ground_truth_data_filename])
                prediction_data_filename = \
                    '/'.join([root, CarDetectionDataFilenamesFinder.prediction_data_filename])
                print("Found ground truth data: " + ground_truth_data_filename)
                print("Found prediction data: " + prediction_data_filename)
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
        help="Base path from which to compute precision and recall recursively")
    return parser

def main():
    """
    Example command:
    python public/files/precision_recall.py public/runs
    """
    parser = get_args_parser()
    args = parser.parse_args()
    if args.base_path:
        car_detection_data_filenames_finder = CarDetectionDataFilenamesFinder(args.base_path)
        car_detection_data = car_detection_data_filenames_finder.data_filenames()
        for run, data in car_detection_data.iteritems():
            print("Computing precision and recall for: " + run)
            precision_recall_calculator = CarDetectionPrecisionRecall(data)
            precision, recall = precision_recall_calculator.get_precision_and_recall()
            print("Precision for run: " + run + " is: " + str(precision))
            print("Recall for run: " + run + " is: " + str(recall))

if __name__ == "__main__":
    main()



from __future__ import division

import argparse
import collections
import json
import fnmatch
import os

# TODO(rchengyue): Restructure project. Create scripts folder with tests inside. Write tests.

CarDetectionDataFilenames = collections.namedtuple(
    'CarDetectionDataFilenames',
    ['ground_truth_data_filename', 'prediction_data_filename'])

PrecisionAndRecall = collections.namedtuple(
    'PrecisionAndRecall',
    ['precision', 'recall'])

class CarDetectionPrecisionRecallCalculator():
    """Calculates the precision and recall based on the
    given prediction and ground truth data.
    """

    ground_truth_frame_count_multiplier = 4
    overlapped_area_ratio_threshold = 0.3

    def __init__(self, car_detection_data_filenames):
        self.ground_truth_data = \
            self._get_json_data(car_detection_data_filenames.ground_truth_data_filename)
        self.prediction_data = \
            self._get_json_data(car_detection_data_filenames.prediction_data_filename)

    def get_precision_and_recall(self):
        total_precision = 0
        total_recall = 0
        total_frames = len(self.prediction_data)

        for frame_count in range(total_frames):
            ground_truth_frame_count = \
                frame_count * CarDetectionPrecisionRecallCalculator.ground_truth_frame_count_multiplier
            # Make sure ground truth frame count is within ground truth data length
            if (ground_truth_frame_count > len(self.ground_truth_data)):
                break
            print "BLAH prediction frame_count: " + str(frame_count)
            print "BLAH ground truth frame count: " + str(ground_truth_frame_count)
            ground_truth_frame_data = self.ground_truth_data[ground_truth_frame_count]
            prediction_frame_data = self.prediction_data[frame_count]
            total_overlapped_boxes = \
                self._get_overlapped_boxes(ground_truth_frame_data, prediction_frame_data)
            print "BLAH total overlapped boxes: " + str(total_overlapped_boxes)
            total_precision += total_overlapped_boxes / len(prediction_frame_data)
            total_recall += total_overlapped_boxes / len(ground_truth_frame_data)

        overall_precision = total_precision / total_frames
        overall_recall = total_recall / total_frames
        return PrecisionAndRecall(overall_precision, overall_recall)

    def _get_json_data(self, filename):
        try:
            with open(filename, 'rb') as f:
                return json.load(f)
        except Exception as e:
            print(e)

    def _get_overlapped_boxes(self, ground_truth_frame_data, prediction_frame_data):
        total_overlapped_boxes = 0
        for prediction_frame_data_box in prediction_frame_data:
            for ground_truth_frame_data_box in ground_truth_frame_data:
                prediction_rect = prediction_frame_data_box['rect']
                ground_truth_rect = ground_truth_frame_data_box['rect']
                if (self._is_overlap(ground_truth_rect, prediction_rect)):
                    overlapped_area_ratio = \
                        self._get_intersect_area(ground_truth_rect, prediction_rect) / \
                        self._get_union_area(ground_truth_rect, prediction_rect)
                    if (overlapped_area_ratio > CarDetectionPrecisionRecallCalculator.overlapped_area_ratio_threshold):
                        total_overlapped_boxes += 1
        return total_overlapped_boxes

    def _is_overlap(self, ground_truth_rect, prediction_rect):
        print "BLAH ground_truth_rect: " + str(ground_truth_rect)
        print "BLAH prediction_rect: " + str(prediction_rect)
        prediction_x = prediction_rect[0]
        prediction_y = prediction_rect[1]
        prediction_width = prediction_rect[2]
        prediction_height = prediction_rect[3]
        return self._is_point_in_rect(
                prediction_x,
                prediction_y,
                ground_truth_rect) \
            or self._is_point_in_rect(
                prediction_x + prediction_width,
                prediction_y,
                ground_truth_rect) \
            or self._is_point_in_rect(
                prediction_x,
                prediction_y + prediction_width,
                ground_truth_rect) \
            or self._is_point_in_rect(
                prediction_x + prediction_width,
                prediction_y + prediction_width,
                ground_truth_rect)

    def _is_point_in_rect(self, x, y, rect):
        rect_x = rect[0]
        rect_y = rect[1]
        rect_width = rect[2]
        rect_height = rect[3]
        return not (x < rect_x or x > rect_x + rect_width or y < rect_y or y > rect_y + rect_height)

    def _get_intersect_area(self, ground_truth_rect, prediction_rect):
        # Refactor code to use Rectangle domain model
        prediction_x = prediction_rect[0]
        prediction_y = prediction_rect[1]
        prediction_width = prediction_rect[2]
        prediction_height = prediction_rect[3]
        ground_truth_x = ground_truth_rect[0]
        ground_truth_y = ground_truth_rect[1]
        ground_truth_width = ground_truth_rect[2]
        ground_truth_height = ground_truth_rect[3]
        return (min(prediction_x + prediction_width, ground_truth_x + ground_truth_width) - max(prediction_x, ground_truth_x)) * \
            (min(prediction_y + prediction_height, ground_truth_y + ground_truth_height) - max(prediction_y, ground_truth_y))

    def _get_union_area(self, ground_truth_rect, prediction_rect):
        ground_truth_area = ground_truth_rect[2] * ground_truth_rect[3]
        prediction_area = prediction_rect[2] * prediction_rect[3]
        return ground_truth_area + prediction_area - self._get_intersect_area(ground_truth_rect, prediction_rect)

class CarDetectionDataFinder():
    """Finds all the prediction and ground truth filenames to compute precision and recall."""

    ground_truth_data_filename = 'bbs-cam2-verified.json'
    prediction_data_filename = 'bbs-cam2.json'
    directory_delimiter = '/'

    def __init__(self, base_path):
        self.base_path = base_path

    def get_data(self):
        print("Finding all the data files to compute precision and recall...")
        car_detection_data = {}
        for root, dirnames, filenames in os.walk(self.base_path):
            for filename in fnmatch.filter(filenames, self.__class__.ground_truth_data_filename):
                ground_truth_data_filename = \
                    self.__class__.directory_delimiter.join([root, self.__class__.ground_truth_data_filename])
                prediction_data_filename = \
                    self.__class__.directory_delimiter.join([root, self.__class__.prediction_data_filename])
                print("Found ground truth data: " + ground_truth_data_filename)
                print("Found prediction data: " + prediction_data_filename)
                car_detection_data[root] = CarDetectionDataFilenames(ground_truth_data_filename, prediction_data_filename)
        return car_detection_data

def get_args_parser():
    parser = argparse.ArgumentParser(
        description="Writes precision and recall of car detection files based on given base path")
    parser.add_argument(
        '-b',
        '--base_path',
        action="store",
        dest="base_path",
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
        car_detection_data_finder = CarDetectionDataFinder(args.base_path)
        car_detection_data = car_detection_data_finder.get_data()
        for run, data in car_detection_data.iteritems():
            print("Computing precision and recall for: " + run)
            precision_recall_calculator = CarDetectionPrecisionRecallCalculator(data)
            precision, recall = precision_recall_calculator.get_precision_and_recall()
            print("Precision for run: " + run + " is: " + str(precision))
            print("Recall for run: " + run + " is: " + str(recall))

if __name__ == "__main__":
    main()



import collections
import fnmatch
import os

CarDetectionDataFilenames = collections.namedtuple(
    'CarDetectionDataFilenames',
    ['ground_truth_datafilename', 'prediction_data_filename'])

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
        self.ground_truth_data_filename = car_detection_data_filenames.ground_truth_data_filename
        self.prediction_data_filename = car_detection_data_filenames.prediction_data_filename

    def get_precision_and_recall(self):
        # TODO(rchengyue): Open data files
        # TODO(rchengyue): Refactor
        total_precision = 0
        total_recall = 0
        total_frames = prediction_data.length
        for frame_count in range(total_frames):
            ground_truth_frame_count = frame_count * self.__class__.ground_truth_frame_count_multiplier
            # Make sure ground truth frame count is within ground truth data length
            if (ground_truth_frame_count > ground_truth_data.length):
                break
            prediction_frame_data = prediction_data[frame_count];
            ground_truth_frame_data = ground_truth_data[ground_truth_frame_count]
            for prediction_frame_data_box in prediction_frame_data:
                for ground_truth_frame_data_box in ground_truth_data:
                    prediction_rect = prediction_frame_data_box['rect']
                    ground_truth_rect = ground_truth_frame_data_box['rect']
                    if (is_overlap(prediction_rect, ground_truth_rect)):
                        overlapped_area_ratio = \
                            get_intersect_area(prediction_rect, ground_truth_rect) /
                            get_union_area(prediction_rect, ground_truth_rect)
                        if (overlapped_area_ratio > self.__class__.overlapped_area_ratio_threshold):
                            total_overlapped_boxes += 1
            total_precision = total_overlapped_boxes / prediction_frame_data.length
            total_recall = total_overlapped_boxes / ground_truth_frame_data.length
        overall_precision = total_precision / total_frames
        overall_recall = total_recall / total_frames
        return PrecisionAndRecall(overall_precision, overall_recall)

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

def main():
    """
    Example command:
    python public/files/precision_recall.py public/runs
    """
    car_detection_data_finder = CarDetectionDataFinder("public/runs")
    car_detection_data = car_detection_data_finder.get_data()
    for run, data in car_detection_data.iteritems():
        print("Computing precision and recall for: " + run)
        precision_recall_calculator = CarDetectionPrecisionRecallCalculator(data)
        precision, recall = precision_recall_calculator.get_precision_and_recall()
        print("Precision for run: " + run + " is: " + str(precision))
        print("Recall for run: " + run + " is: " + str(recall))

if __name__ == "__main__":
    main()



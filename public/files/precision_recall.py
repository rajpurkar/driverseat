import collections
import fnmatch
import os

CarDetectionData = collections.namedtuple('CarDetectionData', ['ground_truth_data', 'prediction_data'])

class CarDetectionPrecisionRecallCalculator():
    """Calculates the precision and recall based on the
    given prediction and ground truth data.
    """

    def __init__(self, car_detection_data):
        self.ground_truth_data = car_detection_data.ground_truth_data
        self.prediction_data = car_detection_data.prediction_data
        self.precision = None
        self.recall = None

    def get_precision_and_recall(self):
        return (0.01, 0.02)

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
                    detection_data_filename = \
                        self.__class__.directory_delimiter.join([root, self.__class__.prediction_data_filename])
                    print("Found ground truth data: " + ground_truth_data_filename)
                    print("Found detection data: " + detection_data_filename)
                    car_detection_data[root] = CarDetectionData(ground_truth_data_filename, detection_data_filename)
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
        print("Precision for run: " + run + " is: " + str(precision));
        print("Recall for run: " + run + " is: " + str(recall));

if __name__ == "__main__":
    main()



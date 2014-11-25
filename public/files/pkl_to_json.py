import argparse
import fnmatch
import numpy
import os
import pickle
import json

from sets import Set

class NumpyAwareJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, numpy.ndarray) and obj.ndim == 1:
            return obj.tolist()
        if isinstance(obj, numpy.bool_):
            return bool(obj)
        if isinstance(obj, numpy.int64) or isinstance(obj, numpy.int32):
            return int(obj)
        if isinstance(obj, numpy.float32):
            return float(obj)
        return json.JSONEncoder.default(self, obj)

class PklToJsonWriter():
    """Create JSON equivalent files for all Pickle files
    under the given base paths.
    """

    def __init__(self, base_paths, is_overwrite):
        self.base_paths = Set(base_paths)
        self.is_overwrite = is_overwrite
        self.visited_files = Set()

    def __get_json_filename__(self, pkl_filename):
        return pkl_filename[:-3] + 'json'

    def __write_json_file__(self, pkl_filename):

        json_filename = self.__get_json_filename__(pkl_filename)

        # Do not write JSON file if JSON file exists
        # and we do not want to overwrite
        if os.path.isfile(json_filename) and not self.is_overwrite:
            print("Will not overwrite JSON file: " + json_filename)
            return

        # Do not write JSON file if already visited Pickle file
        if pkl_filename in self.visited_files:
            print("Already wrote JSON file: " + json_filename)
            return

        with open(pkl_filename, 'rb') as pkl_file:
            print("Loading from Pickle file: " + pkl_filename)
            pickle_obj = pickle.load(pkl_file)
            with open(json_filename, 'wb') as json_file:
                print("Writing to JSON file: " + json_filename)
                json_file.write(
                    json.dumps(pickle_obj, cls=NumpyAwareJSONEncoder))
            self.visited_files.add(pkl_filename)

    def write_json_files(self):
        print("Start writing JSON files")
        for base_path in self.base_paths:
            for root, dirnames, filenames in os.walk(base_path):
                for filename in fnmatch.filter(filenames, '*.pkl'):
                    self.__write_json_file__(os.path.join(root, filename))
        print("Done writing JSON files")

def get_args_parser():
    parser = argparse.ArgumentParser(
        description="Writes JSON files for Pickle files")
    parser.add_argument(
        '-b',
        '--base_paths',
        nargs="*",
        action="store",
        dest="base_paths",
        required=True,
        help="Base paths from which to read Pickle files " \
            + "and write JSON equivalent files recursively")
    parser.add_argument(
        '-o',
        '--overwrite',
        action="store_true",
        dest="overwrite",
        default=False,
        help="Whether or not to overwrite existing JSON files")
    return parser

def main():
    """
    Example command:
    python public/files/pkl_to_json.py \
        -b public/runs/4-10-14-pleasanton/237_b \
           public/runs/4-10-14-pleasanton/238_a \
        -o
    """
    parser = get_args_parser()
    args = parser.parse_args()
    if args.base_paths:
        pkl_to_json_writer = \
            PklToJsonWriter(args.base_paths, args.overwrite)
        pkl_to_json_writer.write_json_files()
    else:
        print("You must specify base paths")
        parser.print_help()

if __name__ == "__main__":
    main()

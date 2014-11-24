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

class PklToJsonConverter():
    def __init__(self, base_paths):
        self.base_paths = Set(base_paths)
        self.visited_files = Set()

    def __get_json_filename__(self, pkl_filename):
        return pkl_filename[:-3] + 'json'

    def __convert_to_json_file__(self, pkl_filename):
        if not pkl_filename in self.visited_files:
            with open(pkl_filename, 'rb') as pkl_file:
                print("Loading from Pickle file: " + pkl_filename)
                pickle_obj = pickle.load(pkl_file)
                json_filename = self.__get_json_filename__(pkl_filename)
                with open(json_filename, 'wb') as json_file:
                    print("Writing to JSON file: " + json_filename)
                    json_file.write(
                        json.dumps(pickle_obj, cls=NumpyAwareJSONEncoder))
                self.visited_files.add(pkl_filename)

    def convert_to_json_files(self):
        for base_path in self.base_paths:
            for root, dirnames, filenames in os.walk(base_path):
                for filename in fnmatch.filter(filenames, '*.pkl'):
                    self.__convert_to_json_file__(os.path.join(root, filename))

def get_args_parser():
    parser = argparse.ArgumentParser(
        description="Converts Pickle files to JSON files")
    parser.add_argument(
        '-b',
        '--base_paths',
        nargs="*",
        action="store",
        dest="base_paths",
        required=True,
        help="Base paths from which to convert " \
            + "all Pickle files to JSON files recursively")
    return parser

def main():
    parser = get_args_parser()
    args = parser.parse_args()
    # Must specify one argument
    if args.base_paths:
        pkl_to_json_converter = PklToJsonConverter(args.base_paths)
        pkl_to_json_converter.convert_to_json_files()
    else:
        print "You must specify an argument"
        parser.print_help()

if __name__ == "__main__":
    main()

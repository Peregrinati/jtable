#! /usr/bin/env python
from __future__ import print_function

import subprocess
import argparse
import string
import sys
import os

CMD_CREATE = 'create '
CMD_ADD = 'add '

parser = argparse.ArgumentParser(
    description='Build jtables')
parser.add_argument('-m', '--make-file',
                    default='../jquery.jtable.build.txt',
                    help='The file containing the list of files to build')
parser.add_argument('-o', '--output-dir',
                    default='../../lib/',
                    help='The directory in which to place the built files')
parser.add_argument('-z', '--minify',
                    default=True,
                    help='Create a minified version of the output file\n'
                         'Requires slimit to be installed')
opts = parser.parse_args()

make_file_name = opts.make_file
build_dir = os.path.dirname(os.path.realpath(make_file_name))
output_dir = os.path.realpath(opts.output_dir)


def printable(s):
    return filter(lambda c: c in string.printable, s).rstrip('\t ')

out_file_name = None

with open(make_file_name, 'r') as make_file:
    make_line = printable(next(make_file))
    if not make_line.startswith(CMD_CREATE):
        sys.exit("Build file must start with a 'create [FILENAME]' line")

    out_file_name = printable(make_line[len(CMD_CREATE):]).strip()
    print("CREATING: " + os.path.join(build_dir, out_file_name))
    os.chdir(build_dir)
    with open(os.path.join(output_dir, out_file_name), 'w') as out_file:
        for make_line in make_file:
            if not make_line.startswith(CMD_ADD):
                sys.exit("Unrecognized command: " + make_line)

            in_file_name = printable(make_line[len(CMD_ADD):]).strip()
            print("ADDING: " + os.path.join(build_dir, in_file_name))

            with open(in_file_name, 'rU') as in_file:
                for line in in_file:
                    lp = printable(line)
                    out_file.write(lp)

if opts.minify and out_file_name:
    os.chdir(output_dir)
    min_name = out_file_name.replace('.js', '.min.js')
    with open(min_name, 'w') as min_file:
        output = subprocess.check_output(['slimit', '--mangle', out_file_name])
        min_file.write(output)

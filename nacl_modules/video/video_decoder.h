#include <stdlib.h>
#include <stdio.h>
#include <string.h>

extern "C" { 
#include "libavcodec/avcodec.h"
#include "libavutil/mathematics.h"
#include "libavutil/samplefmt.h"
#include "libswscale/swscale.h"
#include <jpeglib.h>
}

#include <vector>
#define INBUF_SIZE 4096 

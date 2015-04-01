#include <stdlib.h>
#include <stdio.h>
#include <string.h>

//#ifdef HAVE_AV_CONFIG_H
//#undef HAVE_AV_CONFIG_H
//#endif

extern "C" { 
#include "libavcodec/avcodec.h"
#include "libavutil/mathematics.h"
#include "libavutil/samplefmt.h"
#include "libswscale/swscale.h"
#include <jpeglib.h>
}

#include <vector>
#include <iostream>
#include <fstream>

#define INBUF_SIZE 4096 
#define AUDIO_INBUF_SIZE 20480
#define AUDIO_REFILL_THRESH 4096


//static int init = 0;

int SaveJPEG( unsigned char * const rgb, const unsigned int dwWidth, const unsigned int dwHeight, const int quality )
{

    unsigned char *mem = NULL;
    unsigned long mem_size = 0;
    struct jpeg_compress_struct cinfo;
    struct jpeg_error_mgr jerr;
    JSAMPROW row_pointer[1];
    int row_stride;
    cinfo.err = jpeg_std_error(&jerr);
    jpeg_create_compress(&cinfo);
    jpeg_mem_dest(&cinfo, &mem, &mem_size); 

    cinfo.image_width = dwWidth;  /* image width and height, in pixels */
    cinfo.image_height = dwHeight;
    cinfo.input_components = 3;       /* # of color components per pixel */
    cinfo.in_color_space = JCS_RGB;   /* colorspace of input image */

    jpeg_set_defaults(&cinfo);
    jpeg_set_quality(&cinfo, quality, TRUE /* limit to baseline-JPEG values */);
    jpeg_start_compress(&cinfo, TRUE);
    row_stride = dwWidth * 3;   /* JSAMPLEs per row in image_buffer */

    while (cinfo.next_scanline < cinfo.image_height) {
        row_pointer[0] = & rgb[cinfo.next_scanline * row_stride];
        (void) jpeg_write_scanlines(&cinfo, row_pointer, 1);
    }

    /* Step 6: Finish compression */

    jpeg_finish_compress(&cinfo);

    printf("mem_size = %lu\n", mem_size);
    jpeg_destroy_compress(&cinfo);


    return 1;
}


/*
 * Video decoding example
 */

inline int decode_write_frame( AVCodecContext
        *avctx, AVFrame *frame, int
        *frame_count, AVPacket *pkt, int last,
        AVFrame* &frameRGB, uint8_t* &bufferRGB, struct SwsContext* &sws_ctx, int& init) {
    int len, got_frame;
    char buf[1024];

    len = avcodec_decode_video2(avctx, frame, &got_frame, pkt);
    if (len < 0) {
        fprintf(stderr, "Error while decoding frame %d\n", *frame_count);
        return len;
    }
    if (got_frame) {
        //printf("avctx->width: %d, avctx->height: %d\n", avctx->width, avctx->height);
        if(!init) { 
            frameRGB=av_frame_alloc();
            int numBytes=avpicture_get_size(
                    PIX_FMT_RGB24, avctx->width,
                    avctx->height);
            bufferRGB=(uint8_t*) av_malloc(
                    numBytes*sizeof(uint8_t));

            avpicture_fill((AVPicture*)frameRGB,
                    bufferRGB, PIX_FMT_RGB24,
                    avctx->width,
                    avctx->height);
            sws_ctx =
                sws_getContext
                (avctx->width, avctx->height,
                 avctx->pix_fmt,
                 avctx->width, avctx->height,
                 PIX_FMT_RGB24,
                 SWS_BILINEAR,
                 NULL,
                 NULL,
                 NULL
                );
        init = 1;
        }
        printf("Saving %sframe %3d\n", last ? "last " : "", *frame_count);
        //printf("sws_ctx = %x\n", sws_ctx);
        sws_scale
            (
             sws_ctx,
             (uint8_t const * const *)frame->data,
             frame->linesize,
             0,
             avctx->height,
             frameRGB->data,
             frameRGB->linesize
            );
        SaveJPEG(bufferRGB, avctx->width, avctx->height, 90); 
        (*frame_count)++;
    }
    if (pkt->data) {
        pkt->size -= len;
        pkt->data += len;
    }

    return 0;

}

int vread(void *ptr, size_t count, uint8_t *data, uint64_t vpos, uint64_t length) {
    int to_copy = count;
    if (vpos+count >= length) 
        to_copy = length - vpos - 1;
    memcpy(ptr, data + vpos, to_copy);
    return to_copy;
}

static void video_decode_example(uint8_t * data, uint64_t length)
{
    AVCodec *codec;
    AVCodecContext *c= NULL;
    int frame_count;
    AVFrame *frame;
    uint8_t inbuf[INBUF_SIZE + FF_INPUT_BUFFER_PADDING_SIZE];
    AVPacket avpkt;

    AVFrame *frameRGB = NULL;
    uint8_t *bufferRGB = NULL;
    struct SwsContext      *sws_ctx = NULL;
    av_init_packet(&avpkt);


    /* set end of buffer to 0 (this ensures that no overreading happens for damaged mpeg streams) */
    memset(inbuf + INBUF_SIZE, 0, FF_INPUT_BUFFER_PADDING_SIZE);

    /* find the mpeg1 video decoder */
    codec = avcodec_find_decoder(AV_CODEC_ID_MPEG1VIDEO);
    if (!codec) {
        fprintf(stderr, "Codec not found\n");
        exit(1);
    }

    /* allocate codec context */
    c = avcodec_alloc_context3(codec);
    if (!c) {
        fprintf(stderr, "Could not allocate video codec context\n");
        exit(1);
    }


    if(codec->capabilities&CODEC_CAP_TRUNCATED)
        c->flags|= CODEC_FLAG_TRUNCATED; /* we do not send complete frames */

    /* open it */
    if (avcodec_open2(c, codec, NULL) < 0) {
        fprintf(stderr, "Could not open codec\n");
        exit(1);
    }
    
    frame = av_frame_alloc();
    if (!frame) {
        fprintf(stderr, "Could not allocate video frame\n");
        exit(1);
    }

    frame_count = 0;
    uint64_t vpos = 0;
    int init = 0;

    for (;;) {
        avpkt.size = vread(inbuf, INBUF_SIZE, data, vpos, length); 
        vpos+= avpkt.size;
        if (avpkt.size == 0)
            break;
        /* here, we use a stream based decoder (mpeg1video), so we
           feed decoder and see if it could decode a frame */
        avpkt.data = inbuf;
        while (avpkt.size > 0) { 
            if (decode_write_frame(c, frame, &frame_count, &avpkt, 0, frameRGB, bufferRGB, sws_ctx, init) < 0)
                exit(1);
        }
    }
    /* some codecs, such as MPEG, transmit the I and P frame with a
       latency of one frame. You must do the following to have a
       chance to get the last frame of the video */
    avpkt.data = NULL;
    avpkt.size = 0;
    decode_write_frame(c, frame, &frame_count, &avpkt, 1, frameRGB, bufferRGB, sws_ctx, init);
    avcodec_close(c);
    av_free(c);
    av_free(bufferRGB);
    av_frame_free(&frameRGB);
    av_frame_free(&frame);
    printf("\n");
}

std::vector<uint8_t> readFile(const char* filename)
{
    // open the file:
    std::ifstream file(filename, std::ios::binary);

    // Stop eating new lines in binary mode!!!
    file.unsetf(std::ios::skipws);

    // get its size:
    std::streampos fileSize;

    file.seekg(0, std::ios::end);
    fileSize = file.tellg();
    file.seekg(0, std::ios::beg);

    // reserve capacity
    std::vector<uint8_t> vec;
    vec.reserve(fileSize);

    // read the data:
    vec.insert(vec.begin(),
               std::istream_iterator<uint8_t>(file),
               std::istream_iterator<uint8_t>());

    return vec;
}

int main(int argc, char **argv)
{
    const char *filename;

    /* register all the codecs */
    avcodec_register_all();

    std::vector<uint8_t> bytes = readFile("cam_1.mpg");
    uint8_t* data = bytes.data();
    uint64_t length = bytes.size();

    video_decode_example(data, length);
    video_decode_example(data, length);

    return 0;
}

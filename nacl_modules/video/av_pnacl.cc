#include "ppapi/cpp/instance.h"
#include "ppapi/cpp/module.h"
#include "ppapi/cpp/var.h"
#include "ppapi/cpp/var_dictionary.h"
#include "ppapi/cpp/var_array.h"
#include "ppapi/cpp/var_array_buffer.h"
#include "video_decoder.h"
#include "base64.h"

/// The Instance class.  One of these exists for each instance of your NaCl
/// module on the web page.  The browser will ask the Module object to create
/// a new Instance for each occurrence of the <embed> tag that has these
/// attributes:
///     src="hello_tutorial.nmf"
///     type="application/x-pnacl"
/// To communicate with the browser, you must override HandleMessage() to
/// receive messages from the browser, and use PostMessage() to send messages
/// back to the browser.  Note that this interface is asynchronous.
class VideoNACLInstance : public pp::Instance {
 public:
  /// The constructor creates the plugin-side instance.
  /// @param[in] instance the handle to the browser-side plugin instance.
  explicit VideoNACLInstance(PP_Instance instance) : pp::Instance(instance)
  {}
  virtual ~VideoNACLInstance() {}

  /// Handler for messages coming in from the browser via postMessage().  The
  /// @a var_message can contain be any pp:Var type; for example int, string
  /// Array or Dictinary. Please see the pp:Var documentation for more details.
  /// @param[in] var_message The message posted by the browser.
  virtual void HandleMessage(const pp::Var& var_message) {
    // TODO(sdk_user): 1. Make this function handle the incoming message.
      pp::VarDictionary var_dict(var_message);
      auto cmd = var_dict.Get( "cmd" ).AsString();

      if (cmd == "raw_data") {
          pp::Var var_reply;
          auto data = pp::VarArrayBuffer( var_dict.Get("data"));
          auto length = var_dict.Get("length").AsInt();
          uint8_t* byteData = static_cast<uint8_t*>(data.Map());
          video_decode_example(byteData, length);
          var_reply = pp::Var(length);
          PostMessage(var_reply);
      }
  }

  int SaveJPEG( unsigned char * const rgb, const unsigned int dwWidth, const unsigned int dwHeight, const int quality, const int frame_count )
  {

      PostMessage(pp::Var("Converting to JPEG"));
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

      //printf("mem_size = %lu\n", mem_size);
      pp::VarDictionary msg;
      //pp::VarArrayBuffer pp_data(mem_size);
      //uint8_t * copy = static_cast<uint8_t*>(pp_data.Map());
      //memcpy(copy, mem, mem_size);
      std::string encoded = base64_encode(mem, mem_size);
      encoded = "data:image/jpg;base64," + encoded;
      
      msg.Set( "Type", "CompressedJPEG" );
      msg.Set( "FrameCount", frame_count);
      msg.Set( "Bytes", std::to_string(mem_size));
      msg.Set( "Data", encoded);
      PostMessage(msg);
      jpeg_destroy_compress(&cinfo);


      PostMessage(pp::Var("compressed"));
      return 1;
  }


  /*
   * Video decoding example
   */

  inline int decode_write_frame( AVCodecContext
          *avctx, AVFrame *frame, int
          *frame_count, AVPacket *pkt, int last,
          AVFrame* &frameRGB, uint8_t*
          &bufferRGB, struct SwsContext*
          &sws_ctx, bool &init) {
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
          PostMessage(pp::Var(*frame_count));
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
          SaveJPEG(bufferRGB, avctx->width, avctx->height, 95, *frame_count); 
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

  void video_decode_example(uint8_t * data, uint64_t length)
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
      avcodec_register_all();
      PostMessage(pp::Var("registered"));

      //set end of buffer to 0 (this ensures that no overreading happens for damaged mpeg streams) 
      memset(inbuf + INBUF_SIZE, 0, FF_INPUT_BUFFER_PADDING_SIZE);


      //find the mpeg1 video decoder 
      codec = avcodec_find_decoder(AV_CODEC_ID_MPEG1VIDEO);
      if (!codec) {
          fprintf(stderr, "Codec not found\n");
          exit(1);
      }

      PostMessage(pp::Var("codec found"));
      // allocate codec context 
      c = avcodec_alloc_context3(codec);
      if (!c) {
          fprintf(stderr, "Could not allocate video codec context\n");
          exit(1);
      }

      PostMessage(pp::Var("codec context created"));

      if(codec->capabilities&CODEC_CAP_TRUNCATED)
          c->flags|= CODEC_FLAG_TRUNCATED;

      // open it
      if (avcodec_open2(c, codec, NULL) < 0) {
          fprintf(stderr, "Could not open codec\n");
          exit(1);
      }

      frame = av_frame_alloc();
      if (!frame) {
          fprintf(stderr, "Could not allocate video frame\n");
          exit(1);
      }

      PostMessage(pp::Var("frame_alloc"));
      frame_count = 0;
      uint64_t vpos = 0;
      bool init = false;

      for (;;) {
          avpkt.size = vread(inbuf, INBUF_SIZE, data, vpos, length); 
          vpos+= avpkt.size;
          if (avpkt.size == 0)
              break;
          // here, we use a stream based decoder (mpeg1video), so we
          //  feed decoder and see if it could decode a frame 
          avpkt.data = inbuf;
          while (avpkt.size > 0) { 
              if (decode_write_frame(c, frame, &frame_count, &avpkt, 0, frameRGB, bufferRGB, sws_ctx, init) < 0)
                  exit(1);
          }
      }
      /*
      //some codecs, such as MPEG, transmit the I and P frame with a
      //latency of one frame. You must do the following to have a
      //chance to get the last frame of the video
      avpkt.data = NULL;
      avpkt.size = 0;
      decode_write_frame(c, frame, &frame_count, &avpkt, 1, frameRGB, bufferRGB, sws_ctx);
      */
      PostMessage(pp::Var("cleaning up"));
      avcodec_close(c);
      av_free(c);
      av_free(bufferRGB);
      av_frame_free(&frameRGB);
      av_frame_free(&frame);
      printf("\n");
  }
};

/// The Module class.  The browser calls the CreateInstance() method to create
/// an instance of your NaCl module on the web page.  The browser creates a new
/// instance for each <embed> tag with type="application/x-pnacl".
class VideoNACLModule : public pp::Module {
 public:
  VideoNACLModule() : pp::Module() {}
  virtual ~VideoNACLModule() {}

  /// Create and return a VideoNACLInstance object.
  /// @param[in] instance The browser-side instance.
  /// @return the plugin-side instance.
  virtual pp::Instance* CreateInstance(PP_Instance instance) {
    return new VideoNACLInstance(instance);
  }
};

namespace pp {
/// Factory function called by the browser when the module is first loaded.
/// The browser keeps a singleton of this module.  It calls the
/// CreateInstance() method on the object you return to make instances.  There
/// is one instance per <embed> tag on the page.  This is the main binding
/// point for your NaCl module with the browser.
Module* CreateModule() {
  return new VideoNACLModule();
}
}  // namespace pp

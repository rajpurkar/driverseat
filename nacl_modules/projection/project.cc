#include "ppapi/cpp/instance.h"
#include "ppapi/cpp/module.h"
#include "ppapi/cpp/var.h"
#include "ppapi/cpp/var_dictionary.h"
#include "ppapi/cpp/var_array.h"
#include "ppapi/cpp/var_array_buffer.h"
#include "ppapi/c/pp_errors.h"
#include "ppapi/c/ppb_file_io.h"
#include "ppapi/cpp/file_io.h"
#include "ppapi/cpp/file_ref.h"
#include "ppapi/cpp/file_system.h"

/// The Instance class.  One of these exists for each instance of your NaCl
/// module on the web page.  The browser will ask the Module object to create
/// a new Instance for each occurrence of the <embed> tag that has these
/// attributes:
///     src="hello_tutorial.nmf"
///     type="application/x-pnacl"
/// To communicate with the browser, you must override HandleMessage() to
/// receive messages from the browser, and use PostMessage() to send messages
/// back to the browser.  Note that this interface is asynchronous.
class ProjectionNACLInstance : public pp::Instance {
 public:
  /// The constructor creates the plugin-side instance.
  /// @param[in] instance the handle to the browser-side plugin instance.
  explicit ProjectionNACLInstance(PP_Instance instance) : pp::Instance(instance)
  {}
  virtual ~ProjectionNACLInstance() {}

  /// Handler for messages coming in from the browser via postMessage().  The
  /// @a var_message can contain be any pp:Var type; for example int, string
  /// Array or Dictinary. Please see the pp:Var documentation for more details.
  /// @param[in] var_message The message posted by the browser.
  virtual void HandleMessage(const pp::Var& var_message) {
      pp::VarDictionary var_dict(var_message);
      auto cmd = var_dict.Get( "cmd" ).AsString();

      PrintMessage("NACL: doing: " + cmd);
      if (cmd == "filesystem") { 
          auto filesystem_resource = var_dict.Get("filesystem").AsResource();
          pp::FileSystem filesystem(filesystem_resource);
          pp::FileRef ref(filesystem, "/test.txt");
          pp::FileIO file(this);
          int32_t open_result = file.Open(ref, PP_FILEOPENFLAG_READ, pp::BlockUntilComplete());
          PrintMessage("open_result: " + std::to_string(open_result));
          if (open_result != PP_OK) 
          {
              PrintMessage("ERROR: not found");
              return;
          }
          PrintMessage("Found file: /test.txt");

          PP_FileInfo info;
          int32_t query_result = file.Query(&info, pp::BlockUntilComplete());
          if (query_result != PP_OK) {
              PrintMessage("file query failed");
              return;
          }

          PrintMessage("file size: " + std::to_string(info.size));

          if (info.size > INT32_MAX) {
              PrintMessage("file too big");
              return;
          }
          


      }

      if (cmd == "project") {
          
          //get points
          auto points = pp::VarArrayBuffer(
                  var_dict.Get("point_data"));
          float* point_data = static_cast<float*>(points.Map());
          auto point_data_buffer_size =
              var_dict.Get("point_data_buffer_size").AsInt();
          
          //get colors
          auto colors = pp::VarArrayBuffer(
                  var_dict.Get("color_data"));
          float* color_data = static_cast<float*>(colors.Map());
          auto color_data_buffer_size =
              var_dict.Get("color_data_buffer_size").AsInt();

          // get camera parameters
          auto E_buffer = pp::VarArrayBuffer(var_dict.Get("E_data"));
          auto KK_buffer = pp::VarArrayBuffer(var_dict.Get("KK_data"));
          auto dist_buffer = pp::VarArrayBuffer(var_dict.Get("dist_data"));
          auto dist_data_buffer_size =
              var_dict.Get("dist_data_buffer_size").AsInt();

          float* E_data = static_cast<float*>(E_buffer.Map());
          float* KK_data = static_cast<float*>(KK_buffer.Map());
          float* dist_data = static_cast<float*>(dist_buffer.Map());
          auto z_near_clip = var_dict.Get("z_near_clip").AsDouble();
          auto z_far_clip = var_dict.Get("z_far_clip").AsDouble();

          uint32_t image_width = var_dict.Get("image_width").AsInt();
          uint32_t image_height = var_dict.Get("image_height").AsInt();
          // get canvas parameters
          auto canvas_id = var_dict.Get("canvas_id").AsString();

          ProjectionParams p;
          p.point_data = point_data;
          p.point_data_buffer_size = point_data_buffer_size;
          p.color_data = color_data;
          p.color_data_buffer_size = color_data_buffer_size;
          p.E_data = E_data;
          p.KK_data = KK_data;
          p.dist_data = dist_data;
          p.dist_data_buffer_size = dist_data_buffer_size;
          p.image_width = image_width;
          p.image_height = image_height;
          p.z_near_clip = z_near_clip;
          p.z_far_clip = z_far_clip;
          p.canvas_id = canvas_id;

          projection(&p);
      }
  }


  struct ProjectionParams {
      float *point_data;
      size_t point_data_buffer_size;
      float *color_data;
      size_t color_data_buffer_size; 
      float* E_data;
      float* KK_data;
      float* dist_data;
      size_t dist_data_buffer_size;
      uint32_t image_width;
      uint32_t image_height;
      float z_near_clip;
      float z_far_clip;
      std::string canvas_id;
  }; 

  void PrintMessage(std::string msg) { 
      PostMessage(pp::Var(msg));
  }

  void projection(struct ProjectionParams *p) { 

      float* points = p->point_data;
      size_t num_points = p->point_data_buffer_size / 3; 
      float* colors = p->color_data;
      float* E = p->E_data;
      // note this ordering might need to change depending on if the matrices are stored in row major or column major order
      float fx = p->KK_data[0];
      float cx = p->KK_data[2];
      float fy = p->KK_data[4];
      float cy = p->KK_data[5];

      PrintMessage("fx: " + std::to_string(fx));
      PrintMessage("fy: " + std::to_string(fy));
      PrintMessage("cx: " + std::to_string(cx));
      PrintMessage("cy: " + std::to_string(cy));

      std::vector<float> k(12, 0); 
      for (int i = 0; i < p->dist_data_buffer_size; i++) 
          k[i] = p->dist_data[i];

      std::vector<float> valid_pixels;
      std::vector<float> valid_colors;
      for (int i = 0; i < num_points; i++) {
          float X = points[3*i + 0];
          float Y = points[3*i + 1];
          float Z = points[3*i + 2];

          // see comment on ordering above
          float x = E[0]*X + E[4]*Y + E[8]*Z + E[12];
          float y = E[1]*X + E[5]*Y + E[9]*Z + E[13];
          float z = E[2]*X + E[6]*Y + E[10]*Z + E[14];

          if (z <= p->z_near_clip || z >= p->z_far_clip) continue; 

          // code copied shamelessly from the opencv implementation of cvProjectPoints2: https://github.com/Itseez/opencv/blob/5f590ebed084a5002c9013e11c519dcb139d47e9/modules/calib3d/src/calibration.cpp
          double r2, r4, r6, a1, a2, a3, cdist, icdist2;
          double xd, yd;

          z = z ? 1./z : 1;
          x *= z; y *= z;
          
          r2 = x*x + y*y;
          r4 = r2*r2;
          r6 = r4*r2;
          a1 = 2*x*y;
          a2 = r2 + 2*x*x;
          a3 = r2 + 2*y*y;
          cdist = 1 + k[0]*r2 + k[1]*r4 + k[4]*r6;
          icdist2 = 1./(1 + k[5]*r2 + k[6]*r4 + k[7]*r6);
          xd = x*cdist*icdist2 + k[2]*a1 + k[3]*a2 + k[8]*r2+k[9]*r4;
          yd = y*cdist*icdist2 + k[2]*a3 + k[3]*a1 + k[10]*r2+k[11]*r4;

          float px = xd*fx + cx;
          float py = yd*fy + cy; 

          if (px < 0 || py < 0 || px > p->image_width || py > p->image_height) continue;

          //PrintMessage(std::to_string(px) + ", " + std::to_string(py));
          valid_pixels.push_back(px);
          valid_pixels.push_back(py);

          valid_colors.push_back(colors[3*i+0]);
          valid_colors.push_back(colors[3*i+1]);
          valid_colors.push_back(colors[3*i+2]);
      }
      
      pp::VarDictionary msg;
      auto pixels_bytes = sizeof(float) * valid_pixels.size();
      pp::VarArrayBuffer pixels_msg(pixels_bytes);
      float* pixels_msg_data = static_cast<float*>(pixels_msg.Map());
      memcpy(pixels_msg_data, valid_pixels.data(), pixels_bytes);

      auto colors_bytes = sizeof(float) * valid_colors.size();
      pp::VarArrayBuffer colors_msg(colors_bytes);
      float* colors_msg_data = static_cast<float*>(colors_msg.Map());
      memcpy(colors_msg_data, valid_colors.data(), colors_bytes);

      msg.Set("pixel_data", pixels_msg);
      msg.Set("color_data", colors_msg);
      msg.Set("canvas_id", p->canvas_id);
      msg.Set("Command", "projection");
      PostMessage(msg);

  }

};


/// The Module class.  The browser calls the CreateInstance() method to create
/// an instance of your NaCl module on the web page.  The browser creates a new
/// instance for each <embed> tag with type="application/x-pnacl".
class ProjectionNACLModule : public pp::Module {
 public:
  ProjectionNACLModule() : pp::Module() {}
  virtual ~ProjectionNACLModule() {}

  /// Create and return a ProjectionNACLInstance object.
  /// @param[in] instance The browser-side instance.
  /// @return the plugin-side instance.
  virtual pp::Instance* CreateInstance(PP_Instance instance) {
    return new ProjectionNACLInstance(instance);
  }
};

namespace pp {
    /// Factory function called by the browser when the module is first loaded.
    /// The browser keeps a singleton of this module.  It calls the
    /// CreateInstance() method on the object you return to make instances.  There
    /// is one instance per <embed> tag on the page.  This is the main binding
    /// point for your NaCl module with the browser.
    Module* CreateModule() {
        return new ProjectionNACLModule();
    }
}  // namespace pp

#include <iostream>
#include <vector>
#include <string>

#define NUM_DATA  3*500000

struct ProjectionParams {
    float *point_data;
    size_t point_data_buffer_size;
    float* E_data;
    float* KK_data;
    float* dist_data;
    size_t dist_data_buffer_size;
    size_t image_width;
    size_t image_height;
    float z_near_clip;
    float z_far_clip;
}; 

void PrintMessage(std::string msg) { 
    std::cout << msg << std::endl;
}

void projection(struct ProjectionParams *p) { 
    
    float* points = p->point_data;
    size_t num_points = p->point_data_buffer_size / 3; 
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
    std::vector<int> valid_pixel_idx; 
    for (int i = 0; i < num_points; i++) {
        float X = points[3*i + 0];
        float Y = points[3*i + 1];
        float Z = points[3*i + 2];

        // see comment on ordering above
        float x = E[0]*X + E[4]*Y + E[8]*Z + E[12];
        float y = E[1]*X + E[5]*Y + E[9]*Z + E[13];
        float z = E[2]*X + E[6]*Y + E[10]*Z + E[14];

        if (z <= p->z_near_clip || z >= p->z_far_clip) continue; 

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

        PrintMessage(std::to_string(px) + ", " + std::to_string(py));
        valid_pixels.push_back(px);
        valid_pixels.push_back(py);
        valid_pixel_idx.push_back(i);
    }

}

int main() {

    float byteData[NUM_DATA];
    for (int i = 0; i < NUM_DATA; i++) {
        byteData[i] = i;
        if ((i+1) % 3 == 0) byteData[i] = 10;
    }

    float KK_data[9] = {   200,   0, 640,
                            0, 200, 480,
                            0,   0,   1};


    float E_data[16] =  { 1, 0, 0, 0,
                          0, 1, 0, 0, 
                          0, 0, 1, 0,
                          0, 0, 0, 1 };

    float dist_data[4] = {0.0, 0.0, 0.0, 0.0}; 


    ProjectionParams params;
    params.point_data = byteData;
    params.point_data_buffer_size = NUM_DATA;
    params.E_data = E_data;
    params.KK_data = KK_data;
    params.dist_data = dist_data;
    params.dist_data_buffer_size = 4;
    params.image_width = 1280;
    params.image_height = 960;
    params.z_near_clip = 0;
    params.z_far_clip = 100;
    projection(&params);


}

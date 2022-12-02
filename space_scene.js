import {defs, tiny} from './examples/common.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;

export class space_scene extends Scene {
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();

        this.change = false;
        this.add = false;

        // At the beginning of our program, load one of each of these shape definitions onto the GPU.
        this.shapes = {
            moon: new (defs.Subdivision_Sphere.prototype.make_flat_shaded_version())(1),
            sun : new defs.Subdivision_Sphere(4),
            sphere_1: new defs.Subdivision_Sphere(1),
            sphere_2: new defs.Subdivision_Sphere(2),
            sphere_3: new defs.Subdivision_Sphere(3),
            sphere_4: new defs.Subdivision_Sphere(4),
        };

        // *** Materials
        this.materials = {
            test: new Material(new defs.Phong_Shader(),
                {ambient: .6, diffusivity: .6, color: hex_color("#ffffff")}),
            test2: new Material(new Gouraud_Shader(),
                {ambient: .6, diffusivity: .6, color: hex_color("#992828")}),
            sun: new Material(new defs.Phong_Shader(),
                {ambient: 1, diffusivity: .6, color: hex_color("#ffffff")}),
        }
        this.color = ["#808080", "#80FFFF", "#B08040", "#93CAED",
            "#A865C9", "#98fb98", "#ffffe0", "#FFD580",
            "#FFB6C1","#D3D3D3", "#5ca904", "#ffca89",
            "#e57f8c", "#d0e0ee", "#6f909d", "#967c94"];
        this.sun_color = ["#FFD580", "#880808", "#FFFFFF"];

        this.initial_camera_location = Mat4.look_at(vec3(0, 10, 20), vec3(0, 0, 0), vec3(0, 1, 0));
        this.sun_current_color = hex_color(this.sun_color[0]);//hex_color(this.sun_color[Math.floor(temp_random*3)]);
        this.random = [];
    }

    display(context, program_state) {
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(this.initial_camera_location);
        }

        const light_position = vec4(0, 5, 5, 1);
        program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 1000)];

        const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;

        // set the values of random generalized galaxy
        let galaxy_transform = Mat4.identity();
        const temp_random = Math.random();
        let num_planets = 5;

        if (Math.floor(t) % 10 === 0){
            this.change = true;
            let r = Math.round(Math.random()*3)
            // window.alert(r)
            this.sun_current_color = hex_color(this.sun_color[r]);
            num_planets = Math.floor(Math.random()*5)+2;
            this.new_random = []
            for (let i = 0; i < num_planets; i ++) {
                this.new_random.push(Math.random());
            }
            this.random = this.new_random
        } else {
            this.change = false;
        }

        //movement of spaceship - implement as movement of galaxy
        if (this.change){
            galaxy_transform = Mat4.translation(-120, 0, 0).times(Mat4.translation(0, 0, -40+5*Math.sin(0.5*t)));
        } else {
            galaxy_transform = Mat4.translation(5*(t % 10), 0, 0).times(Mat4.translation(0, 0, -40+5*Math.sin(0.5*t)));
        }

        let sun_model_transform = Mat4.identity();
        sun_model_transform = sun_model_transform.times(galaxy_transform);

        let sun_radius = 2 + Math.sin(2*Math.PI/20*t - Math.PI/2);
        sun_model_transform = sun_model_transform.times(Mat4.scale(sun_radius, sun_radius,sun_radius));

        // sun lighting
        // a point light source of the same color of the sun
        // located in the center of the sun
        // 10**n where n is the current sun radius
        let sun_light = new Light(galaxy_transform.times(vec4(0, 0, 0, 1)), this.sun_current_color, 10**sun_radius);
        program_state.lights = [sun_light];

        //changed test to sun material
        this.shapes.sun.draw(context,program_state, sun_model_transform,
            this.materials.sun.override({color: this.sun_current_color}));

        let rotation_speed  = 1;
        let speed_delta = 0.1;

        let current_planets = [];
        let current_ball = [];
        let current_color = [];
        let current_shading = [];

        if (this.change){
            current_planets = [];
            current_ball = [];
            current_color = [];
            current_shading = [];
        }

        if(this.change || current_ball.length === 0){
            for (let i = 0; i < num_planets; i++) {
                //const random_value = Math.random();
                var random_value = this.random[i]
                if (i === 0){
                    rotation_speed = 1;
                }
                let temp_planet_transform = Mat4.identity();
                temp_planet_transform = temp_planet_transform.times(galaxy_transform);
                temp_planet_transform = temp_planet_transform.times(Mat4.rotation(rotation_speed * t, 0, 1, 0))
                    .times(Mat4.translation(5 + i * 3, 0, 0));
                rotation_speed = rotation_speed - speed_delta;

                const rand_sphere = Math.floor(random_value * 4) + 1;
                const rand_texture = Math.floor(random_value * 2);
                const rand_color = hex_color(this.color[Math.round(random_value * this.color.length)]);

                let temp_shape = this.shapes.sphere_4;
                switch (rand_sphere) {
                    case 1:
                        temp_shape = this.shapes.sphere_1;
                        break;
                    case 2:
                        temp_shape = this.shapes.sphere_2;
                        break;
                    case 3:
                        temp_shape = this.shapes.sphere_3;
                        break;
                    default:
                        break;
                }
                let temp_materials = this.materials.test;
                if (rand_texture === 1) {
                    temp_materials = this.materials.test2;
                }

                current_ball.push(temp_shape);
                current_planets.push(temp_planet_transform);
                current_shading.push(temp_materials);
                current_color.push(rand_color);
            }
        }

        for (let i = 0; i < current_planets.length; i++) {
            current_ball[i].draw(context, program_state, current_planets[i],
                current_shading[i].override({color: current_color[i]}));
        }
    }
}

class Gouraud_Shader extends Shader {
    // This is a Shader using Phong_Shader as template

    constructor(num_lights = 2) {
        super();
        this.num_lights = num_lights;
    }

    shared_glsl_code() {
        // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
        return ` 
        precision mediump float;
        const int N_LIGHTS = ` + this.num_lights + `;
        uniform float ambient, diffusivity, specularity, smoothness;
        uniform vec4 light_positions_or_vectors[N_LIGHTS], light_colors[N_LIGHTS];
        uniform float light_attenuation_factors[N_LIGHTS];
        uniform vec4 shape_color;
        uniform vec3 squared_scale, camera_center;

        // Specifier "varying" means a variable's final value will be passed from the vertex shader
        // on to the next phase (fragment shader), then interpolated per-fragment, weighted by the
        // pixel fragment's proximity to each of the 3 vertices (barycentric interpolation).
        varying vec3 N, vertex_worldspace;
        
        // Gouraud Shader
        varying vec4 VERTEX_COLOR;
        
        // ***** PHONG SHADING HAPPENS HERE: *****                                       
        vec3 phong_model_lights( vec3 N, vec3 vertex_worldspace ){                                        
            // phong_model_lights():  Add up the lights' contributions.
            vec3 E = normalize( camera_center - vertex_worldspace );
            vec3 result = vec3( 0.0 );
            for(int i = 0; i < N_LIGHTS; i++){
                // Lights store homogeneous coords - either a position or vector.  If w is 0, the 
                // light will appear directional (uniform direction from all points), and we 
                // simply obtain a vector towards the light by directly using the stored value.
                // Otherwise if w is 1 it will appear as a point light -- compute the vector to 
                // the point light's location from the current surface point.  In either case, 
                // fade (attenuate) the light as the vector needed to reach it gets longer.  
                vec3 surface_to_light_vector = light_positions_or_vectors[i].xyz - 
                                               light_positions_or_vectors[i].w * vertex_worldspace;                                             
                float distance_to_light = length( surface_to_light_vector );

                vec3 L = normalize( surface_to_light_vector );
                vec3 H = normalize( L + E );
                // Compute the diffuse and specular components from the Phong
                // Reflection Model, using Blinn's "halfway vector" method:
                float diffuse  =      max( dot( N, L ), 0.0 );
                float specular = pow( max( dot( N, H ), 0.0 ), smoothness );
                float attenuation = 1.0 / (1.0 + light_attenuation_factors[i] * distance_to_light * distance_to_light );
                
                vec3 light_contribution = shape_color.xyz * light_colors[i].xyz * diffusivity * diffuse
                                                          + light_colors[i].xyz * specularity * specular;
                result += attenuation * light_contribution;
            }
            return result;
        } `;
    }

    vertex_glsl_code() {
        // ********* VERTEX SHADER *********
        return this.shared_glsl_code() + `
            attribute vec3 position, normal;                            
            // Position is expressed in object coordinates.
            
            uniform mat4 model_transform;
            uniform mat4 projection_camera_model_transform;
    
            void main(){                                                                   
                // The vertex's final resting place (in NDCS):
                gl_Position = projection_camera_model_transform * vec4( position, 1.0 );
                // The final normal vector in screen space.
                N = normalize( mat3( model_transform ) * normal / squared_scale);
                vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
                
                //color calculations moved to vertex shader
                vec4 vertex_color = vec4(shape_color.xyz * ambient, shape_color.w );
                vertex_color.xyz += phong_model_lights( N, vertex_worldspace );
                VERTEX_COLOR = vertex_color;
            } `;
    }

    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        // A fragment is a pixel that's overlapped by the current triangle.
        // Fragments affect the final image or get discarded due to depth.
        return this.shared_glsl_code() + `
            void main(){
                //move calculation to vertex shader                                                           
                // Compute an initial (ambient) color:
                //gl_FragColor = vec4( shape_color.xyz * ambient, shape_color.w );
                gl_FragColor = VERTEX_COLOR;
                // Compute the final color with contributions from lights:
                //gl_FragColor.xyz = vertex_color.xyz;
            } `;
    }

    send_material(gl, gpu, material) {
        // send_material(): Send the desired shape-wide material qualities to the
        // graphics card, where they will tweak the Phong lighting formula.
        gl.uniform4fv(gpu.shape_color, material.color);
        gl.uniform1f(gpu.ambient, material.ambient);
        gl.uniform1f(gpu.diffusivity, material.diffusivity);
        gl.uniform1f(gpu.specularity, material.specularity);
        gl.uniform1f(gpu.smoothness, material.smoothness);
    }

    send_gpu_state(gl, gpu, gpu_state, model_transform) {
        // send_gpu_state():  Send the state of our whole drawing context to the GPU.
        const O = vec4(0, 0, 0, 1), camera_center = gpu_state.camera_transform.times(O).to3();
        gl.uniform3fv(gpu.camera_center, camera_center);
        // Use the squared scale trick from "Eric's blog" instead of inverse transpose matrix:
        const squared_scale = model_transform.reduce(
            (acc, r) => {
                return acc.plus(vec4(...r).times_pairwise(r))
            }, vec4(0, 0, 0, 0)).to3();
        gl.uniform3fv(gpu.squared_scale, squared_scale);
        // Send the current matrices to the shader.  Go ahead and pre-compute
        // the products we'll need of the of the three special matrices and just
        // cache and send those.  They will be the same throughout this draw
        // call, and thus across each instance of the vertex shader.
        // Transpose them since the GPU expects matrices as column-major arrays.
        const PCM = gpu_state.projection_transform.times(gpu_state.camera_inverse).times(model_transform);
        gl.uniformMatrix4fv(gpu.model_transform, false, Matrix.flatten_2D_to_1D(model_transform.transposed()));
        gl.uniformMatrix4fv(gpu.projection_camera_model_transform, false, Matrix.flatten_2D_to_1D(PCM.transposed()));

        // Omitting lights will show only the material color, scaled by the ambient term:
        if (!gpu_state.lights.length)
            return;

        const light_positions_flattened = [], light_colors_flattened = [];
        for (let i = 0; i < 4 * gpu_state.lights.length; i++) {
            light_positions_flattened.push(gpu_state.lights[Math.floor(i / 4)].position[i % 4]);
            light_colors_flattened.push(gpu_state.lights[Math.floor(i / 4)].color[i % 4]);
        }
        gl.uniform4fv(gpu.light_positions_or_vectors, light_positions_flattened);
        gl.uniform4fv(gpu.light_colors, light_colors_flattened);
        gl.uniform1fv(gpu.light_attenuation_factors, gpu_state.lights.map(l => l.attenuation));
    }

    update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
        // update_GPU(): Define how to synchronize our JavaScript's variables to the GPU's.  This is where the shader
        // recieves ALL of its inputs.  Every value the GPU wants is divided into two categories:  Values that belong
        // to individual objects being drawn (which we call "Material") and values belonging to the whole scene or
        // program (which we call the "Program_State").  Send both a material and a program state to the shaders
        // within this function, one data field at a time, to fully initialize the shader for a draw.

        // Fill in any missing fields in the Material object with custom defaults for this shader:
        const defaults = {color: color(0, 0, 0, 1), ambient: 0, diffusivity: 1, specularity: 1, smoothness: 40};
        material = Object.assign({}, defaults, material);

        this.send_material(context, gpu_addresses, material);
        this.send_gpu_state(context, gpu_addresses, gpu_state, model_transform);
    }
}

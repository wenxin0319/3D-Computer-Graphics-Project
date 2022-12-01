import {defs, tiny} from './examples/common.js';
// Pull these names into this module's scope for convenience:
const {vec3, vec4, vec, color, hex_color, Matrix, Mat4, Light, Shape, Material, Shader, Texture, Scene} = tiny;
const {Cube, Axis_Arrows, Textured_Phong, Phong_Shader, Basic_Shader, Subdivision_Sphere} = defs

import {Color_Phong_Shader, Shadow_Textured_Phong_Shader,
    Depth_Texture_Shader_2D, Buffered_Texture, LIGHT_DEPTH_TEX_SIZE} from './examples/shadow-demo-shaders.js'


export class Shape_From_File extends Shape
{                                   // **Shape_From_File** is a versatile standalone Shape that imports
                                    // all its arrays' data from an .obj 3D model file.
    constructor( filename )
    { super( "position", "normal", "texture_coord" );
        // Begin downloading the mesh. Once that completes, return
        // control to our parse_into_mesh function.
        this.load_file( filename );
    }
    load_file( filename )
    {                             // Request the external file and wait for it to load.
        // Failure mode:  Loads an empty shape.
        return fetch( filename )
            .then( response =>
            { if ( response.ok )  return Promise.resolve( response.text() )
            else                return Promise.reject ( response.status )
            })
            .then( obj_file_contents => this.parse_into_mesh( obj_file_contents ) )
            .catch( error => { this.copy_onto_graphics_card( this.gl ); } )
    }
    parse_into_mesh( data )
    {                           // Adapted from the "webgl-obj-loader.js" library found online:
        var verts = [], vertNormals = [], textures = [], unpacked = {};

        unpacked.verts = [];        unpacked.norms = [];    unpacked.textures = [];
        unpacked.hashindices = {};  unpacked.indices = [];  unpacked.index = 0;

        var lines = data.split('\n');

        var VERTEX_RE = /^v\s/;    var NORMAL_RE = /^vn\s/;    var TEXTURE_RE = /^vt\s/;
        var FACE_RE = /^f\s/;      var WHITESPACE_RE = /\s+/;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            var elements = line.split(WHITESPACE_RE);
            elements.shift();

            if      (VERTEX_RE.test(line))   verts.push.apply(verts, elements);
            else if (NORMAL_RE.test(line))   vertNormals.push.apply(vertNormals, elements);
            else if (TEXTURE_RE.test(line))  textures.push.apply(textures, elements);
            else if (FACE_RE.test(line)) {
                var quad = false;
                for (var j = 0, eleLen = elements.length; j < eleLen; j++)
                {
                    if(j === 3 && !quad) {  j = 2;  quad = true;  }
                    if(elements[j] in unpacked.hashindices)
                        unpacked.indices.push(unpacked.hashindices[elements[j]]);
                    else
                    {
                        var vertex = elements[ j ].split( '/' );

                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 0]);
                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 1]);
                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 2]);

                        if (textures.length)
                        {   unpacked.textures.push(+textures[( (vertex[1] - 1)||vertex[0]) * 2 + 0]);
                            unpacked.textures.push(+textures[( (vertex[1] - 1)||vertex[0]) * 2 + 1]);  }

                        unpacked.norms.push(+vertNormals[( (vertex[2] - 1)||vertex[0]) * 3 + 0]);
                        unpacked.norms.push(+vertNormals[( (vertex[2] - 1)||vertex[0]) * 3 + 1]);
                        unpacked.norms.push(+vertNormals[( (vertex[2] - 1)||vertex[0]) * 3 + 2]);

                        unpacked.hashindices[elements[j]] = unpacked.index;
                        unpacked.indices.push(unpacked.index);
                        unpacked.index += 1;
                    }
                    if(j === 3 && quad)   unpacked.indices.push( unpacked.hashindices[elements[0]]);
                }
            }
        }
        {
            const { verts, norms, textures } = unpacked;
            for( var j = 0; j < verts.length/3; j++ )
            {
                this.arrays.position     .push( vec3( verts[ 3*j ], verts[ 3*j + 1 ], verts[ 3*j + 2 ] ) );
                this.arrays.normal       .push( vec3( norms[ 3*j ], norms[ 3*j + 1 ], norms[ 3*j + 2 ] ) );
                this.arrays.texture_coord.push( vec( textures[ 2*j ], textures[ 2*j + 1 ] ) );
            }
            this.indices = unpacked.indices;
        }
        this.normalize_positions( false );
        this.ready = true;
    }
    draw( context, program_state, model_transform, material )
    {               // draw(): Same as always for shapes, but cancel all
        // attempts to draw the shape before it loads:
        if( this.ready )
            super.draw( context, program_state, model_transform, material );
    }
}

export class Roaming extends Scene {
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();
        this.center =  Mat4.identity().times(Mat4.translation(-15,-9,0));

        // At the beginning of our program, load one of each of these shape definitions onto the GPU.
        this.shapes = {
            spaceship_top: new defs.Subdivision_Sphere(4),
            spaceship_bottom: new defs.Torus(50, 50),
            triangle: new defs.Triangle(),
            astronaut: new Shape_From_File("assets/astronaut.obj"),
            bs: new Shape_From_File("assets/bs.obj"),
            fly: new Shape_From_File("assets/fly.obj"),
            land: new Shape_From_File("assets/land.obj"),
            rocket: new Shape_From_File("assets/rocket.obj"),
        };

        // *** Materials
        this.materials = {
            background: new Material(new defs.Phong_Shader(),
                {ambient: 1, diffusivity: 1, color: hex_color("#ffffff")}),
            spaceship: new Material(new defs.Phong_Shader(),
                {ambient: 1, diffusivity: 1, color: hex_color("#808080")}),
            astronaut: new Material(new Shadow_Textured_Phong_Shader(1), {
                color: color(.5, .5, .5, 1),
                ambient: .4, diffusivity: .5, specular: .5,
                color_texture: new Texture("assets/astronaut.jpg"),
                light_depth_texture: null
            }),
            bs: new Material(new Shadow_Textured_Phong_Shader(1), {
                color: color(.5, .5, .5, 1),
                ambient: .4, diffusivity: .5, specular: .5,
                color_texture: new Texture("assets/bs.jpg"),
                light_depth_texture: null
            }),
            fly: new Material(new Shadow_Textured_Phong_Shader(1), {
                color: color(.5, .5, .5, 1),
                ambient: .4, diffusivity: .5, specular: .5,
                color_texture: new Texture("assets/fly.jpg"),
                light_depth_texture: null
            }),
            land: new Material(new Shadow_Textured_Phong_Shader(1), {
                color: color(.5, .5, .5, 1),
                ambient: .4, diffusivity: .5, specular: .5,
                color_texture: new Texture("assets/land.jpg"),
                light_depth_texture: null
            }),
            rocket: new Material(new Shadow_Textured_Phong_Shader(1), {
                color: color(.5, .5, .5, 1),
                ambient: .4, diffusivity: .5, specular: .5,
                color_texture: new Texture("assets/rocket.jpg"),
                light_depth_texture: null
            }),

        }

        this.initial_camera_location = Mat4.look_at(vec3(0, 10, 20), vec3(0, 0, 0), vec3(0, 1, 0));
    }

    make_control_panel() {
        // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
        this.key_triggered_button("View solar system", ["Control", "0"], () => this.attached = () => this.initial_camera_location);
        this.new_line();
        this.key_triggered_button("View the inner spaceship", ["Control", "1"], () => this.attached = () => null);
        this.new_line();
        this.key_triggered_button("View the location of spaceship", ["Control", "2"], () => this.attached = () => null);
        this.new_line();
        this.key_triggered_button("View the outer spaceship", ["Control", "3"], () => this.attached = () => null);
    }

    display(context, program_state) {

        // display():  Called once per frame of animation.
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(this.initial_camera_location);
        }

        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, .1, 1000);
        const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;

        let re = 0.5 * Math.cos(0.1 * Math.PI * t) + 0.5;
        let light_color = color(1, re, re, 1);

        const light_position = vec4(0, 10, 6, 1);
        // The parameters of the Light are: position, color, size
        program_state.lights = [new Light(light_position, light_color, 10**(1+(1%2)))];


        this.randomPosition = []
        for (let i = 0; i < 50; i++) {
            if(i % 3 == 0 || i % 5 == 0) {
                this.randomPosition.push(-Math.random()*20.0);
            } else {
                this.randomPosition.push(Math.random()*20.0);
            }
        }

        for (let i = 0; i < 50; i++) {
            this.material_transform = Mat4.identity().times(Mat4.translation(this.randomPosition[i], this.randomPosition[i + 2], 0)).times(Mat4.scale(.1, .1, 0));
            this.shapes.triangle.draw(context, program_state, this.material_transform, this.materials.background.override(vec4(1, 1, 1, 1)));
        }

        let galaxy_transform = Mat4.identity();
        // galaxy_transform = Mat4.translation(Math.sin(0.5*t),Math.cos(0.5*t), 0);
        galaxy_transform = Mat4.translation(-120, 0, 0).times(Mat4.translation(0, 0, -40+5*Math.sin(0.5*t)));
        this.shapes.astronaut.draw(context, program_state, galaxy_transform, this.materials.astronaut);
        // this.shapes.fly.draw(context, program_state, galaxy_transform, this.materials.fly);
        // this.shapes.bs.draw(context, program_state, galaxy_transform, this.materials.bs);
        // this.shapes.land.draw(context, program_state, galaxy_transform, this.materials.land);
        // this.shapes.rocket.draw(context, program_state, galaxy_transform, this.materials.rocket);



        let desired;
        if (this.attached != undefined) {
            if (this.attached() == this.initial_camera_location) {
                desired = this.attached();
            }
            else { // set camera 5 units away from attached planet
                desired = Mat4.inverse(this.attached().times(Mat4.translation(0, 0, 5)));
            }
            // smooth transitions
            desired = desired.map((x, i) => Vector.from(program_state.camera_inverse[i]).mix(x, 0.1));
            program_state.set_camera(desired);
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
        varying vec4 vertex_color;
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
                
                vertex_color = vec4( shape_color.xyz * ambient, shape_color.w );
                vertex_color.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
            } `;
    }

    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        // A fragment is a pixel that's overlapped by the current triangle.
        // Fragments affect the final image or get discarded due to depth.
        return this.shared_glsl_code() + `
            void main(){                                                           
                gl_FragColor = vec4( vertex_color.xyz, 1.0 );
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

class Ring_Shader extends Shader {
    update_GPU(context, gpu_addresses, graphics_state, model_transform, material) {
        // update_GPU():  Defining how to synchronize our JavaScript's variables to the GPU's:
        const [P, C, M] = [graphics_state.projection_transform, graphics_state.camera_inverse, model_transform],
            PCM = P.times(C).times(M);
        context.uniformMatrix4fv(gpu_addresses.model_transform, false, Matrix.flatten_2D_to_1D(model_transform.transposed()));
        context.uniformMatrix4fv(gpu_addresses.projection_camera_model_transform, false,
            Matrix.flatten_2D_to_1D(PCM.transposed()));
    }

    shared_glsl_code() {
        // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
        return `
        precision mediump float;
        varying vec4 point_position;
        varying vec4 center;
        `;
    }

    vertex_glsl_code() {
        // ********* VERTEX SHADER *********
        return this.shared_glsl_code() + `
        attribute vec3 position;
        uniform mat4 model_transform;
        uniform mat4 projection_camera_model_transform;
        
        void main(){
            gl_Position = projection_camera_model_transform * vec4(position, 1);
            point_position =model_transform * vec4(position, 1);
            center = model_transform  * vec4(0, 0, 0, 1);
          
        }`;
    }

    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        return this.shared_glsl_code() + `
        void main(){
            float b_distance = length(point_position.xyz - center.xyz);
            float factor = 0.5 + 0.5 * sin(b_distance*30.0);
            gl_FragColor = factor * vec4(0.69, 0.502, 0.251, 1);
          
        }`;
    }
}


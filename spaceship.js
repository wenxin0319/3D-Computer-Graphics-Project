import {defs, tiny} from './examples/common.js';
// Pull these names into this module's scope for convenience:
const {vec3, vec4, vec, color, hex_color, Matrix, Mat4, Light, Shape, Material, Shader, Texture, Scene} = tiny;
const {Cube, Axis_Arrows, Textured_Phong, Phong_Shader, Basic_Shader, Subdivision_Sphere} = defs

import {Color_Phong_Shader, Shadow_Textured_Phong_Shader,
    Depth_Texture_Shader_2D, Buffered_Texture, LIGHT_DEPTH_TEX_SIZE} from './examples/shadow-demo-shaders.js'
import {Text_Line} from "./examples/text-demo.js";

// 2D shape, to display the texture buffer
const Square =
    class Square extends tiny.Vertex_Buffer {
        constructor() {
            super("position", "normal", "texture_coord");
            this.arrays.position = [
                vec3(0, 0, 0), vec3(1, 0, 0), vec3(0, 1, 0),
                vec3(1, 1, 0), vec3(1, 0, 0), vec3(0, 1, 0)
            ];
            this.arrays.normal = [
                vec3(0, 0, 1), vec3(0, 0, 1), vec3(0, 0, 1),
                vec3(0, 0, 1), vec3(0, 0, 1), vec3(0, 0, 1),
            ];
            this.arrays.texture_coord = [
                vec(0, 0), vec(1, 0), vec(0, 1),
                vec(1, 1), vec(1, 0), vec(0, 1)
            ]
        }
    }

export class Shape_From_File extends Shape
{   // **Shape_From_File** is a versatile standalone Shape that imports
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



// The scene
export class spaceship_scene extends Scene {
    constructor() {
        super();
        // Load the model file:
        this.shapes = {
            //"teapot": new Shape_From_File("assets/teapot.obj"),
            "sphere": new Subdivision_Sphere(6),
            "cube": new defs.Cube(),
            "square_2d": new Square(),
            'lamp': new defs.Torus(3, 9),
            'ball_1': new defs.Regular_2D_Polygon(1, 15),
            'ball_2': new Subdivision_Sphere(4),
            'ball_3': new (Subdivision_Sphere.prototype.make_flat_shaded_version())(1),
            'text': new Text_Line(35),
            'peo1': new Shape_From_File("assets/1.obj"),
            'peo2': new Shape_From_File("assets/2.obj"),
            'peo3': new Shape_From_File("assets/3.obj"),
            'peo4': new Shape_From_File("assets/4.obj"),
            'peo5': new Shape_From_File("assets/5.obj"),
            'peo6': new Shape_From_File("assets/6.obj"),
            'peo7': new Shape_From_File("assets/7.obj"),
            'tow1': new Shape_From_File("assets/tower.obj"),
            'pow1': new Shape_From_File("assets/power.obj"),
            'tri': new Subdivision_Sphere(0),
            'torus': new defs.Torus_thin(50, 50),
            'astronaut': new Shape_From_File("assets/astronaut.obj"),
        };

        this.materials = {
            wood: new Material(new Shadow_Textured_Phong_Shader(1),
                {ambient: 0.3, diffusivity: .6, color: color(0.71, 0.39, 0.11, 1), smoothness: 60,
                color_texture: new Texture("assets/Wood-Pattern.jpg"),
                light_depth_texture:null}),
            floor: new Material(new Shadow_Textured_Phong_Shader(1),
                {ambient: 0.2, diffusivity: .6, color: color(0.3, 0.3, 0.3, 1), smoothness: 60,
                color_texture: new Texture("assets/marble_gray.jpg"),
                light_depth_texture:null}),
            couch: new Material(new Shadow_Textured_Phong_Shader(10),
                {ambient: .3, diffusivity: .5, color: color(115/255, 147/255, 179/255, 1), smoothness: 60}),
            // wall: new Material(new Shadow_Textured_Phong_Shader(1),
            //     {ambient: 0.3, diffusivity: 0.3, color: color(188/255, 186/255, 181/255, 1), smoothness: 60}),
            wall: new Material(new Shadow_Textured_Phong_Shader(1),
                {ambient: 0.5, diffusivity: 0.3, color: hex_color("#f2f2f2"), smoothness: 60}),
            wall_met: new Material(new Shadow_Textured_Phong_Shader(1), {
                    color: color(.45, .45, .45, 1),
                    ambient: .3, diffusivity: .5, specular: .5,
                    color_texture: new Texture("assets/metallic.jpg"),
                    light_depth_texture: null
                }),
            wall_transp: new Material(new Shadow_Textured_Phong_Shader(1),
                {ambient: 0.5, diffusivity: 0.3, color: color(1,1,1,0.1), smoothness: 60}),
            wall_sun: new Material(new Shadow_Textured_Phong_Shader(1), {
                color: color(.5, .5, .5, 1),
                ambient: .4, diffusivity: .5, specular: .5,
                color_texture: new Texture("assets/Sun_2k.jpg"),
                light_depth_texture: null
            }),
            wall_saturn: new Material(new Shadow_Textured_Phong_Shader(1), {
                color: color(.5, .5, .5, 1),
                ambient: .4, diffusivity: .5, specular: .5,
                color_texture: new Texture("assets/Saturn_2k.jpg"),
                light_depth_texture: null
            }),
            wall_neptune: new Material(new Shadow_Textured_Phong_Shader(1), {
                color: color(.5, .5, .5, 1),
                ambient: .4, diffusivity: .5, specular: .5,
                color_texture: new Texture("assets/Neptune_2k.jpg"),
                light_depth_texture: null
            }),
            control: new Material(new Color_Phong_Shader(1),
                {ambient: 0.5, diffusivity: 0.3, specular: 0.5, color: hex_color("#424242"), smoothness: 30}),
            screen: new Material(new Shadow_Textured_Phong_Shader(1),
                {ambient: 0.3, diffusivity: 0.3, color: color(107/255, 142/255, 35/255, 1), smoothness: 60}),
            lamp_head:new Material(new Shadow_Textured_Phong_Shader(1),
                {ambient: 1.0, diffusivity: 0.3, color: color(255/255, 182/255, 193/255, 1), smoothness: 60}),
            lamp_main:new Material(new Shadow_Textured_Phong_Shader(1),
                {ambient: 0.7, diffusivity: 0.6, color: color(102/255, 102/255, 102/255, 1), smoothness: 80}),
            screen_texture1: new Material(new Shadow_Textured_Phong_Shader(1), {
                color: color(0.4, 0.4, 0.4, 1),
                ambient: 0.7,
                color_texture: new Texture("assets/loc1.jpg"),
                light_depth_texture: null
            }),
            screen_texture2: new Material(new Shadow_Textured_Phong_Shader(1), {
                color: color(0.4, 0.4, 0.4, 1),
                ambient:0.7,
                color_texture: new Texture("assets/loc2.jpg"),
                light_depth_texture: null
            }),
            screen_texture3: new Material(new Shadow_Textured_Phong_Shader(1), {
                color: color(0.4, 0.4, 0.4, 1),
                ambient:0.7,
                color_texture: new Texture("assets/loc3.jpg"),
                light_depth_texture: null
            }),
            screen_texture4: new Material(new Shadow_Textured_Phong_Shader(1), {
                color: color(0.4, 0.4, 0.4, 1),
                ambient:0.7,
                color_texture: new Texture("assets/loc4.jpg"),
                light_depth_texture: null
            }),
            tow_tex1: new Material(new Shadow_Textured_Phong_Shader(1), {
                color: color(0.4, 0.4, 0.4, 1),
                ambient:0.7,
                color_texture: new Texture("assets/tower.jpg"),
                light_depth_texture: null
            }),
            pow_tex1: new Material(new Shadow_Textured_Phong_Shader(1), {
                color: color(0.4, 0.4, 0.4, 1),
                ambient:0.7,
                color_texture: new Texture("assets/power.jpg"),
                light_depth_texture: null
            }),
            peo_tex1: new Material(new Shadow_Textured_Phong_Shader(1), {
                color: color(0.4, 0.4, 0.4, 1),
                ambient:0.8,
                color_texture: new Texture("assets/1.jpg"),
                light_depth_texture: null
            }),
            peo_tex2: new Material(new Shadow_Textured_Phong_Shader(1), {
                color: color(0.4, 0.4, 0.4, 1),
                ambient:0.8,
                color_texture: new Texture("assets/2.jpg"),
                light_depth_texture: null
            }),
            peo_tex3: new Material(new Shadow_Textured_Phong_Shader(1), {
                color: color(0.4, 0.4, 0.4, 1),
                ambient:0.8,
                color_texture: new Texture("assets/3.jpg"),
                light_depth_texture: null
            }),
            peo_tex4: new Material(new Shadow_Textured_Phong_Shader(1), {
                color: color(0.4, 0.4, 0.4, 1),
                ambient:0.8,
                color_texture: new Texture("assets/4.jpg"),
                light_depth_texture: null
            }),
            peo_tex5: new Material(new Shadow_Textured_Phong_Shader(1), {
                color: color(0.4, 0.4, 0.4, 1),
                ambient:0.8,
                color_texture: new Texture("assets/5.jpg"),
                light_depth_texture: null
            }),
            peo_tex6: new Material(new Shadow_Textured_Phong_Shader(1), {
                color: color(0.4, 0.4, 0.4, 1),
                ambient:0.8,
                color_texture: new Texture("assets/6.jpg"),
                light_depth_texture: null
            }),
            peo_tex7: new Material(new Shadow_Textured_Phong_Shader(1), {
                color: color(0.4, 0.4, 0.4, 1),
                ambient:0.8,
                color_texture: new Texture("assets/7.jpg"),
                light_depth_texture: null
            }),
            astronaut: new Material(new Shadow_Textured_Phong_Shader(1),
                {ambient: 0.5, diffusivity: .6, color: color(1, 1, 1, 1), smoothness: 60,
                color_texture: new Texture("assets/astronaut.jpg"),
                light_depth_texture:null}),
            spaceship_met: new Material(new Shadow_Textured_Phong_Shader(1),
                {ambient: 0.5, diffusivity: 1, color: color(.2, .2, .2, 1), smoothness: 60,
                color_texture: new Texture("assets/metallic_2.jpg"),
                light_depth_texture:null}),

        };
        // For light source
        this.light_src = new Material(new Phong_Shader(), {
            color: color(1, 1, 1, 1), ambient: 1, diffusivity: 0, specularity: 0
        });

        // For the floor or other plain objects
        this.shadow = new Material(new Shadow_Textured_Phong_Shader(1), {
            color: color(1, 1, 1, 1), ambient: .3, diffusivity: 0.6, specular: 0.4, smoothness: 64, alpha: 0.8,
            color_texture: null,
            light_depth_texture: null
        })
        // For the first pass
        this.pure = new Material(new Color_Phong_Shader(), {
        })
        this.picture_texture = new Material(new defs.Fake_Bump_Map(1), {
        })
        // For light source
        this.light_src = new Material(new Phong_Shader(), {
            color: color(1, 1, 1, 1), ambient: 1, diffusivity: 0, specular: 0
        });
        // For depth texture display
        this.depth_tex =  new Material(new Depth_Texture_Shader_2D(), {
            color: color(0, 0, .0, 1),
            ambient: 1, diffusivity: 0, specular: 0, texture: null
        });

        this.colors = [color(1, 1, 1, 1),color(1, 1, 204/255, 1),color(1, 1, 153/255, 1),color(1, 1, 102/255, 1),
            color(1, 1, 51/255, 1),color(1, 1, 0, 1),color(1, 204/255, 153/255, 1),color(1, 204/255, 102/255, 1),
            color(1, 204/255, 51/255),color(1, 204/255, 0, 1)];
        this.lamp_colors = [color(1, 1, 1, 1),color(1, 1, 204/255, 1),color(1, 204/255, 153/255, 1),color(1, 204/255, 0, 1)];



        // To make sure texture initialization only does once
        this.init_ok = false;
        
        this.v_x_1 = .6;
        this.v_y_1 = .5;
        this.v_z_1 = .2;
        
        this.d_x_1 = 1;
        this.d_y_1 = 1;
        this.d_z_1 = 1;

        this.last_transform_1 = Mat4.identity().times(Mat4.translation(-6, -2, 0));

        this.v_x_2 = .1;
        this.v_y_2 = .2;
        this.v_z_2 = .5;
        
        this.d_x_2 = -1;
        this.d_y_2 = -1;
        this.d_z_2 = 1;

        this.last_transform_2 = Mat4.identity().times(Mat4.translation(-2, -2, -10));

        this.m_1 = 0.01
        this.m_2 = 0.1

        this.d_astro = -1;
        this.v_astro = 0.5;
        this.last_transform_astro = Mat4.identity().times(Mat4.translation(10, -2, -18)).times(Mat4.rotation(- Math.PI / 8, 1, 0, 1)).times(Mat4.rotation(Math.PI, 0, 1, 0)).times(Mat4.scale(2.5, 2.5, 2));

        this.sun_texture = true;
        this.saturn_texture = false;
        this.neptune_texture = false;

        this.show_projection = false;
        this.clr = 0;
    }

    make_control_panel() {
        // // make_control_panel(): Sets up a panel of interactive HTML elements, including
        // // Add buttons so the user can actively toggle data members of our Scene:
        this.key_triggered_button("Holographic Projection", ["h"], function () {
            this.show_projection = !this.show_projection;
            this.clr = 0;
        });
        this.new_line();
        this.key_triggered_button("Push the Plate", ["p"], function () {
            if (this.d_z_1 > 0) {
                this.v_z_1 -= .5;
            } else {this.v_z_1 += .5};
            this.v_y_1 += .1;
            this.v_x_1 += .1;
        });
        this.new_line();
        this.key_triggered_button("Push the Ball", ["b"], function () {
            if (this.d_z_2 > 0) {
                this.v_z_2 -= .5;
            } else {this.v_z_2 += .5};
            this.v_y_2 += .1;
            this.v_x_2 += .1;
        });
        this.new_line();
        this.key_triggered_button("Change Theme: Sun", ["s"], function () {
            this.sun_texture = true;
            this.saturn_texture = false;
            this.neptune_texture = false;
        });
        this.new_line();
        this.key_triggered_button("Change Theme: Saturn", ["a"], function () {
            this.saturn_texture = true;
            this.sun_texture = false;
            this.neptune_texture = false;
        });
        this.new_line();
        this.key_triggered_button("Change Theme: Neptune", ["n"], function () {
            this.neptune_texture = true;
            this.sun_texture = false;
            this.saturn_texture = false;
        });
    }

    texture_buffer_init(gl) {
        // Depth Texture
        this.lightDepthTexture = gl.createTexture();
        // Bind it to TinyGraphics
        this.light_depth_texture = new Buffered_Texture(this.lightDepthTexture);
        //this.stars.light_depth_texture = this.light_depth_texture
        this.shadow.light_depth_texture = this.light_depth_texture
        this.materials.wood.light_depth_texture = this.light_depth_texture
        this.materials.couch.light_depth_texture = this.light_depth_texture
        this.materials.wall.light_depth_texture = this.light_depth_texture
        this.materials.screen.light_depth_texture = this.light_depth_texture
        this.materials.lamp_head.light_depth_texture = this.light_depth_texture
        this.materials.lamp_main.light_depth_texture = this.light_depth_texture
        this.materials.tow_tex1.light_depth_texture = this.light_depth_texture
        this.materials.pow_tex1.light_depth_texture = this.light_depth_texture
        this.materials.peo_tex1.light_depth_texture = this.light_depth_texture
        this.materials.peo_tex2.light_depth_texture = this.light_depth_texture
        this.materials.peo_tex3.light_depth_texture = this.light_depth_texture
        this.materials.peo_tex4.light_depth_texture = this.light_depth_texture
        this.materials.peo_tex5.light_depth_texture = this.light_depth_texture
        this.materials.peo_tex6.light_depth_texture = this.light_depth_texture
        this.materials.peo_tex7.light_depth_texture = this.light_depth_texture

        this.lightDepthTextureSize = LIGHT_DEPTH_TEX_SIZE;
        gl.bindTexture(gl.TEXTURE_2D, this.lightDepthTexture);
        gl.texImage2D(
            gl.TEXTURE_2D,      // target
            0,                  // mip level
            gl.DEPTH_COMPONENT, // internal format
            this.lightDepthTextureSize,   // width
            this.lightDepthTextureSize,   // height
            0,                  // border
            gl.DEPTH_COMPONENT, // format
            gl.UNSIGNED_INT,    // type
            null);              // data
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // Depth Texture Buffer
        this.lightDepthFramebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.lightDepthFramebuffer);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,       // target
            gl.DEPTH_ATTACHMENT,  // attachment point
            gl.TEXTURE_2D,        // texture target
            this.lightDepthTexture,         // texture
            0);                   // mip level
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // create a color texture of the same size as the depth texture
        // see article why this is needed_
        this.unusedTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.unusedTexture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            this.lightDepthTextureSize,
            this.lightDepthTextureSize,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null,
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        // attach it to the framebuffer
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,        // target
            gl.COLOR_ATTACHMENT0,  // attachment point
            gl.TEXTURE_2D,         // texture target
            this.unusedTexture,         // texture
            0);                    // mip level
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    render_scene(context, program_state, shadow_pass, draw_light_source=false, draw_shadow=false) {
        // shadow_pass: true if this is the second pass that draw the shadow.
        // draw_light_source: true if we want to draw the light source.
        // draw_shadow: true if we want to draw the shadow
        
        program_state.draw_shadow = draw_shadow;

        let light_position = this.light_position;
        let light_color = this.light_color;
        if (shadow_pass) {
            this.shapes.sphere.draw(context, program_state,
                Mat4.translation(light_position[0] + 6, light_position[1] + 3, light_position[2]).times(Mat4.scale(.5,.5,.5)),
                this.light_src.override({color: light_color}));
        }
        let t = program_state.animation_time / 1000.0, dt = program_state.animation_delta_time / 1000;

        // draw astronaut
        let astronaut_transform = this.last_transform_astro;
        if (t % 16 < 8){
            this.d_astro = 1;
        }else{
            this.d_astro = -1;
        }
        astronaut_transform = astronaut_transform.times(Mat4.translation(0, this.d_astro * this.v_astro / 600, 0));
        // astronaut_transform = astronaut_transform.times(Mat4.translation(10, 2 * this.v_astro * this.d_astro * t, -18)).times(Mat4.rotation(- Math.PI / 8, 1, 0, 1)).times(Mat4.rotation(Math.PI, 0, 1, 0)).times(Mat4.scale(2.5, 2.5, 2));
        this.shapes.astronaut.draw(context, program_state, astronaut_transform, this.materials.astronaut);
        this.last_transform_astro = astronaut_transform;

        //draw chair
        let chair_model_transform = Mat4.identity();
        //move chair to designated location
        chair_model_transform = chair_model_transform.times(Mat4.translation(9, -3, -5))
            .times(Mat4.rotation(Math.PI*3/2,0, 1, 0));

        //draw chair legs
        let leg_transform_1 = chair_model_transform.times(Mat4.translation(-2, -4.1, -2)).times(Mat4.translation(-1, 0, -1))
            .times(Mat4.scale(0.25, 1, 0.25));
        let leg_transform_2 = chair_model_transform.times(Mat4.translation(-2, -4.1, -2)).times(Mat4.translation(1, 0, -1))
            .times(Mat4.scale(0.25, 1, 0.25));
        let leg_transform_3 = chair_model_transform.times(Mat4.translation(-2, -4.1, -2)).times(Mat4.translation(-1, 0, 1))
            .times(Mat4.scale(0.25, 1, 0.25));
        let leg_transform_4 = chair_model_transform.times(Mat4.translation(-2, -4.1, -2)).times(Mat4.translation(1, 0, 1))
            .times(Mat4.scale(0.25, 1, 0.25));

        //draw chair seat
        let seat_transform = chair_model_transform.times(Mat4.translation(-2, -4.1, -2)).times(Mat4.translation(0, 1, 0))
            .times(Mat4.scale(1.2, 0.25, 1.2));

        //draw chair back
        let back_transform = chair_model_transform.times(Mat4.translation(-2, -4.1, -2)).times(Mat4.translation(1, 2, 0)).times(Mat4.rotation(- Math.PI / 2, 0, 1, 0))
            .times(Mat4.scale(1.2,1.2,0.25));

        this.shapes.cube.draw(context, program_state, leg_transform_1, shadow_pass? this.materials.wood.override({color: hex_color("#424242")}): this.pure);
        this.shapes.cube.draw(context, program_state, leg_transform_2, shadow_pass? this.materials.wood.override({color: hex_color("#424242")}): this.pure); //this.shadow:this.materials.wood
        this.shapes.cube.draw(context, program_state, leg_transform_3, shadow_pass? this.materials.wood.override({color: hex_color("#424242")}): this.pure);
        this.shapes.cube.draw(context, program_state, leg_transform_4, shadow_pass? this.materials.wood.override({color: hex_color("#424242")}): this.pure);
        this.shapes.cube.draw(context, program_state, seat_transform, shadow_pass? this.materials.wood.override({color: hex_color("#424242")}): this.pure);
        this.shapes.cube.draw(context, program_state, back_transform, shadow_pass? this.materials.wood.override({color: hex_color("#424242")}): this.pure);

        this.shapes.cube.draw(context, program_state, Mat4.translation(5, 0, 0).times(leg_transform_1), shadow_pass? this.materials.wood.override({color: hex_color("#424242")}): this.pure);
        this.shapes.cube.draw(context, program_state,  Mat4.translation(5, 0, 0).times(leg_transform_2), shadow_pass? this.materials.wood.override({color: hex_color("#424242")}): this.pure); //this.shadow:this.materials.wood
        this.shapes.cube.draw(context, program_state,  Mat4.translation(5, 0, 0).times(leg_transform_3), shadow_pass? this.materials.wood.override({color: hex_color("#424242")}): this.pure);
        this.shapes.cube.draw(context, program_state,  Mat4.translation(5, 0, 0).times(leg_transform_4), shadow_pass? this.materials.wood.override({color: hex_color("#424242")}): this.pure);
        this.shapes.cube.draw(context, program_state,  Mat4.translation(5, 0, 0).times(seat_transform), shadow_pass? this.materials.wood.override({color: hex_color("#424242")}): this.pure);
        this.shapes.cube.draw(context, program_state,  Mat4.translation(5, 0, 0).times(back_transform), shadow_pass? this.materials.wood.override({color: hex_color("#424242")}): this.pure);

        if (this.show_projection){
            if (this.clr < 0.9){
                this.clr += 0.1 / 100
            }
            let people1_transform = Mat4.identity();
            people1_transform = people1_transform.times(Mat4.translation(30, -4, 6)).times(Mat4.rotation(3 *Math.PI/2, 0, 1, 0)).times(Mat4.scale(1.5,1.5,1.5)); // woman in red dress and grey heels chatting
            this.shapes.peo1.draw(context, program_state, people1_transform, shadow_pass? this.materials.peo_tex1.override({color: color(0.4, 0.4, 0.4, this.clr)}): this.pure);

            let people2_transform = Mat4.identity();
            people2_transform = people2_transform.times(Mat4.translation(25, -5, -2)).times(Mat4.rotation(2 * Math.PI/2, 0, 1, 0)).times(Mat4.scale(1.5,1.5,1.5)); // kid holding ball
            this.shapes.peo2.draw(context, program_state, people2_transform, shadow_pass? this.materials.peo_tex2.override({color: color(0.4, 0.4, 0.4, this.clr)}): this.pure);

            let people3_transform = Mat4.identity();
            people3_transform = people3_transform.times(Mat4.translation(26, -4, 6)).times(Mat4.rotation(Math.PI/2, 0, 1, 0)).times(Mat4.scale(1.5,1.5,1.5)); // woman in red dress and red heels chatting
            this.shapes.peo3.draw(context, program_state, people3_transform, shadow_pass? this.materials.peo_tex3.override({color: color(0.4, 0.4, 0.4, this.clr)}): this.pure);

            let people4_transform = Mat4.identity();
            people4_transform = people4_transform.times(Mat4.translation(8, -4.7, 12)).times(Mat4.rotation(3 * Math.PI/2, 0, 1, 0)).times(Mat4.scale(1.5,1.5,1.5)); // blue jacket man talking
            this.shapes.peo4.draw(context, program_state, people4_transform, shadow_pass? this.materials.peo_tex4.override({color: color(0.4, 0.4, 0.4, this.clr)}): this.pure);

            let people5_transform = Mat4.identity();
            people5_transform = people5_transform.times(Mat4.translation(6, -4.6, 12)).times(Mat4.rotation(Math.PI/2, 0, 1, 0)).times(Mat4.scale(1.5,1.5,1.5)); // black jacket man talking
            this.shapes.peo5.draw(context, program_state, people5_transform, shadow_pass? this.materials.peo_tex5.override({color: color(0.4, 0.4, 0.4, this.clr)}): this.pure);

            let people6_transform = Mat4.identity();
            people6_transform = people6_transform.times(Mat4.translation(5, -4, -2)).times(Mat4.rotation(2 * Math.PI/2, 0, 1, 0)).times(Mat4.scale(1.5,1.5,1.5)); // woman with child in hand
            this.shapes.peo6.draw(context, program_state, people6_transform, shadow_pass? this.materials.peo_tex6.override({color: color(0.4, 0.4, 0.4, this.clr)}): this.pure);

            let people7_transform = Mat4.identity();
            people7_transform = people7_transform.times(Mat4.translation(28, -3.6, -2)).times(Mat4.rotation(4 * Math.PI/2, 0, 1, 0)).times(Mat4.scale(2,2,2));
            this.shapes.peo7.draw(context, program_state, people7_transform,shadow_pass? this.materials.peo_tex7.override({color: color(0.4, 0.4, 0.4, this.clr)}): this.pure);

            let tower_transform = Mat4.identity();
            tower_transform = tower_transform.times(Mat4.translation(2, -4.5, -10)).times(Mat4.scale(1.5,1.5,1.5));
            this.shapes.tow1.draw(context, program_state, tower_transform, shadow_pass? this.materials.tow_tex1.override({color: color(0.4, 0.4, 0.4, this.clr)}): this.pure);

            let power_transform = Mat4.identity();
            power_transform = power_transform.times(Mat4.translation(28, -6, 8)).times(Mat4.scale(1,1,1));
            this.shapes.pow1.draw(context, program_state, power_transform, shadow_pass? this.materials.pow_tex1.override({color: color(0.4, 0.4, 0.4, this.clr)}): this.pure);
        }

        // this.shapes.cube.draw(context, program_state, leg_transform_1, shadow_pass? this.materials.wood: this.materials.wood_texture);
        // this.shapes.cube.draw(context, program_state, leg_transform_2, shadow_pass? this.materials.wood: this.materials.wood_texture); //this.shadow:this.materials.wood
        // this.shapes.cube.draw(context, program_state, leg_transform_3, shadow_pass? this.materials.wood: this.materials.wood_texture);
        // this.shapes.cube.draw(context, program_state, leg_transform_4, shadow_pass? this.materials.wood: this.materials.wood_texture);
        // this.shapes.cube.draw(context, program_state, seat_transform, shadow_pass? this.materials.wood: this.materials.wood_texture);
        // this.shapes.cube.draw(context, program_state, back_transform, shadow_pass? this.materials.wood: this.materials.wood_texture);

        //draw couch
        let couch_model_transform = Mat4.identity();
        //move chair to designated location
        couch_model_transform = couch_model_transform.times(Mat4.translation(-6, -3.75, 9)).times(Mat4.translation(10, 0, 3))
            .times(Mat4.rotation(Math.PI*3/2,0, 1, 0));
        //couch lower cushion
        let couch_lower_transform = couch_model_transform.times(Mat4.translation(-6, -3.75, 9)).times(Mat4.scale(6, 0.5, 1));
        //couch top cushion
        let couch_top_transform = couch_model_transform.times(Mat4.translation(-6, -3.75, 9)).times(Mat4.translation(0,0.75,0))
            .times(Mat4.scale(6, 0.25, 1));
        //couch back
        let couch_back_transform = couch_model_transform.times(Mat4.translation(-6, -3.5, 9)).times(Mat4.translation(0,1,-1.5))
            .times(Mat4.scale(6, 1.825, 0.5));
        //couch arm right
        let couch_arm_1_transform = couch_model_transform.times(Mat4.translation(-6, -3.75, 9)).times(Mat4.translation(5.5,.75,0))
            .times(Mat4.scale(0.5, 1.3,1));
        //couch arm left
        let couch_arm_2_transform = couch_model_transform.times(Mat4.translation(-6, -3.75, 9)).times(Mat4.translation(-5.5,.75,0))
            .times(Mat4.scale(0.5, 1.3,1));

        this.shapes.cube.draw(context, program_state, couch_lower_transform, shadow_pass? this.materials.couch: this.pure); //this.shadow:this.materials.couch
        this.shapes.cube.draw(context, program_state, couch_top_transform, shadow_pass? this.materials.couch: this.pure);
        this.shapes.cube.draw(context, program_state, couch_back_transform, shadow_pass? this.materials.couch: this.pure);
        this.shapes.cube.draw(context, program_state, couch_arm_1_transform, shadow_pass? this.materials.couch: this.pure);
        this.shapes.cube.draw(context, program_state, couch_arm_2_transform, shadow_pass? this.materials.couch: this.pure);
        
        // let test_transform = Mat4.identity();
        // test_transform = test_transform.times(Mat4.translation(-2, -3.5, -1))
        // this.shapes.cube.draw(context, program_state, test_transform, shadow_pass? this.materials.wall: this.pure);

        // draws the wall with window
        let window_model_transform = Mat4.identity();
        let window1_model_transform = window_model_transform.times(Mat4.translation(15, -6.5, -15)).times(Mat4.scale(15, 1.5, 0.1))
        let window2_model_transform = window_model_transform.times(Mat4.translation(15, 8, -15)).times(Mat4.scale(15, 2, 0.1))
        let window3_model_transform = window_model_transform.times(Mat4.translation(-6, 1, -15)).times(Mat4.scale(9, 9, 0.1)) // wall to left of window
        let window4_model_transform = window_model_transform.times(Mat4.translation(29, 2.5, -15)).times(Mat4.scale(1, 7.5, 0.1)) // wall to right of window
        let window5_model_transform = window_model_transform.times(Mat4.translation(18.6, -2, 0)).times(Mat4.translation(19.1, -2.89, -15)).times(Mat4.scale(11, 11/ Math.sqrt(3),  0.1))
        let window6_model_transform = window_model_transform.times(Mat4.translation(18.6, 2, 0)).times(Mat4.translation(13.2, -1, -15)).times(Mat4.rotation(-Math.PI/2, 0, 0, 1)).times(Mat4.scale(11, 11 / Math.sqrt(3), 0.1))

        this.shapes.cube.draw(context, program_state, window1_model_transform, shadow_pass? this.materials.wall_met:this.pure); //this.shadow:this.materials.wall
        this.shapes.cube.draw(context, program_state, window2_model_transform, shadow_pass? this.materials.wall_met:this.pure);
        this.shapes.cube.draw(context, program_state, window3_model_transform, shadow_pass? this.materials.wall_met:this.pure);
        this.shapes.cube.draw(context, program_state, window4_model_transform, shadow_pass? this.materials.wall_met:this.pure);
        this.shapes.tri.draw(context, program_state, window5_model_transform, shadow_pass? this.materials.wall_met:this.pure);
        this.shapes.tri.draw(context, program_state, window6_model_transform, shadow_pass? this.materials.wall_met:this.pure);

        // draw window walls on our side
        let window7_model_transform = Mat4.translation(-23, -36.8, 0).times(Mat4.rotation(Math.PI / 2, 0, 0, 1)).times(window5_model_transform);
        let window8_model_transform = Mat4.translation(-23, -36.8, 0).times(Mat4.rotation(Math.PI / 2, 0, 0, 1)).times(window6_model_transform);
        this.shapes.tri.draw(context, program_state, window7_model_transform, shadow_pass? this.materials.spaceship_met.override({color:color(0,0,0,1)}):this.pure);
        this.shapes.tri.draw(context, program_state, window8_model_transform, shadow_pass? this.materials.spaceship_met.override({color:color(0,0,0,1)}):this.pure);
        this.shapes.tri.draw(context, program_state, Mat4.translation(0, 0, 36).times(window7_model_transform), shadow_pass? this.materials.spaceship_met.override({ambient: 0.3,color:color(0,0,0,1)}):this.pure);
        this.shapes.tri.draw(context, program_state, Mat4.translation(0, 0, 36).times(window8_model_transform), shadow_pass? this.materials.spaceship_met.override({ambient: 0.3,color:color(0,0,0,1)}):this.pure);

        // draws the walls on the ends
        let wall_model_transform = Mat4.identity();
        let wall1_model_transform = wall_model_transform.times(Mat4.translation(37.6, 1.1, 3)).times(Mat4.rotation(Math.PI/2, 0, 1, 0)).times(Mat4.rotation(-Math.PI/4, 1, 0, 0)).times(Mat4.scale(18, 12.9, 0.1));
        let wall2_model_transform = wall_model_transform.times(Mat4.translation(-15, 1.1, 3)).times(Mat4.rotation(Math.PI/2, 0, 1, 0)).times(Mat4.scale(18, 9, 0.1));

        if (this.sun_texture){
            this.shapes.cube.draw(context, program_state, wall1_model_transform, shadow_pass? this.materials.wall_sun: this.pure);
            this.shapes.cube.draw(context, program_state, wall2_model_transform, shadow_pass? this.materials.wall_sun: this.pure);
        }
        else if (this.saturn_texture){
            this.shapes.cube.draw(context, program_state, wall1_model_transform, shadow_pass? this.materials.wall_saturn: this.pure);
            this.shapes.cube.draw(context, program_state, wall2_model_transform, shadow_pass? this.materials.wall_saturn: this.pure);
        }
        else if (this.neptune_texture){
            this.shapes.cube.draw(context, program_state, wall1_model_transform, shadow_pass? this.materials.wall_neptune: this.pure);
            this.shapes.cube.draw(context, program_state, wall2_model_transform, shadow_pass? this.materials.wall_neptune: this.pure);
        }

        let wall1_left_model_transform = Mat4.translation(-23, -36.6, 0).times(Mat4.rotation(Math.PI / 2, 0, 0, 1)).times(wall1_model_transform);
        this.shapes.cube.draw(context, program_state, wall1_left_model_transform, shadow_pass? this.materials.spaceship_met: this.pure);
        
        // draws the roof
        let roof_model_transform = Mat4.identity();
        roof_model_transform = roof_model_transform.times(Mat4.translation(6.8, 10, 3)).times(Mat4.rotation(Math.PI/2, 1, 0, 0)).times(Mat4.scale(22, 18, 0.1))

        this.shapes.cube.draw(context, program_state, roof_model_transform, shadow_pass? this.materials.wall: this.pure);

        // draws the floor
        let floor_model_transform = Mat4.identity();
        floor_model_transform = floor_model_transform.times(Mat4.translation(7.1, -8, 3)).times(Mat4.rotation(Math.PI/2, 1, 0, 0)).times(Mat4.scale(39.8, 18, 0.1))
        this.shapes.cube.draw(context, program_state, floor_model_transform, shadow_pass? this.materials.floor: this.pure);

        // draws landing legs
        let spaceship_leg_transform = Mat4.identity();
        spaceship_leg_transform = spaceship_leg_transform.times(Mat4.translation(-15, -10, 2)).times(Mat4.rotation(Math.PI/2, 1, 0, 0)).times(Mat4.scale(6, 6, 8))
        this.shapes.torus.draw(context, program_state, spaceship_leg_transform, shadow_pass? this.materials.spaceship_met.override({ambient: 0.3,color:color(0,0,0,1)}): this.pure);
        this.shapes.torus.draw(context, program_state, Mat4.translation(15, 0, 0).times(spaceship_leg_transform), shadow_pass? this.materials.spaceship_met.override({ambient: 0.3, color:color(0,0,0,1)}): this.pure);
        this.shapes.torus.draw(context, program_state, Mat4.translation(30, 0, 0).times(spaceship_leg_transform), shadow_pass? this.materials.spaceship_met.override({ambient: 0.3,color:color(0,0,0,1)}): this.pure);
        this.shapes.torus.draw(context, program_state, Mat4.translation(45, 0, 0).times(spaceship_leg_transform), shadow_pass? this.materials.spaceship_met.override({ambient: 0.3,color:color(0,0,0,1)}): this.pure);
        this.shapes.torus.draw(context, program_state, Mat4.translation(50, 22, -3).times(Mat4.scale(3, 1, 3)).times(spaceship_leg_transform), shadow_pass? this.materials.spaceship_met.override({ambient: 0.3,color:color(0,0,0,1)}): this.pure);
        this.shapes.torus.draw(context, program_state, Mat4.translation(35, 26, -1).times(Mat4.scale(2, 1, 2)).times(spaceship_leg_transform), shadow_pass? this.materials.spaceship_met.override({ambient: 0.3,color:color(0,0,0,1)}): this.pure);

        // draws the wall enclosing the spaceship
        this.shapes.cube.draw(context, program_state, Mat4.translation(-7, 0, 36).times(Mat4.scale(1.2, 1, 1)).times(window1_model_transform), shadow_pass? this.materials.spaceship_met:this.pure); //this.shadow:this.materials.wall
        this.shapes.cube.draw(context, program_state,  Mat4.translation(-7, 0, 36).times(Mat4.scale(1.2, 1, 1)).times(window2_model_transform), shadow_pass? this.materials.spaceship_met:this.pure);
        this.shapes.cube.draw(context, program_state,  Mat4.translation(-8, 0, 36).times(Mat4.scale(0.5, 1, 1)).times(window3_model_transform), shadow_pass? this.materials.spaceship_met:this.pure);
        this.shapes.cube.draw(context, program_state,  Mat4.translation(-1, -1, 36).times(Mat4.scale(1, 0.88, 1)).times(window4_model_transform), shadow_pass? this.materials.spaceship_met:this.pure);
        this.shapes.tri.draw(context, program_state,  Mat4.translation(0, 0, 36).times(window5_model_transform), shadow_pass? this.materials.spaceship_met.override({ambient: 0.3,color:color(0, 0, 0, 1)}):this.pure);
        this.shapes.tri.draw(context, program_state,  Mat4.translation(0, 0, 36).times(window6_model_transform), shadow_pass? this.materials.spaceship_met.override({ambient: 0.3,color:color(0, 0, 0, 1)}):this.pure);


        //draw the lamp
        let lamp_head_transform = Mat4.identity();
        // let lamp_main_transform = Mat4.identity();

        lamp_head_transform = lamp_head_transform.times(Mat4.translation(-8, 9, 0)).times(Mat4.rotation(Math.PI/2, 1, 0, 0)).times(Mat4.scale(2, 10, 0.1));
        //let lamp_head_inner_transform =  lamp_head_transform.times(Mat4.scale(1.5, 1.5, 0.1))
        // lamp_main_transform =  lamp_main_transform.times(Mat4.translation(-5, -5, 0)).times(Mat4.rotation(Math.PI/2, 1, 0, 0)).times(Mat4.scale(0.2, 0.2, 4));

        
        let choice = Math.floor(t * 1000 % 4);
        //this.shapes.lamp.draw(context, program_state, lamp_head_transform, shadow_pass? this.materials.lamp_head.override({color: this.colors[choice]}): this.pure);
        this.shapes.cube.draw(context, program_state, Mat4.translation(0, 0.8, 0).times(lamp_head_transform), shadow_pass? this.materials.lamp_head.override({color: color(1, 1, 1, 1)}): this.pure);
        //this.shapes.cube.draw(context, program_state, Mat4.translation(15, 0, 0).times(lamp_head_transform), shadow_pass? this.materials.lamp_head.override({color: color(1, 1, 1, 1)}): this.pure);
        
        let design_lamp_transform = Mat4.identity();
        // let lamp_main_transform = Mat4.identity();
        design_lamp_transform = design_lamp_transform.times(Mat4.translation(6, 9, 0)).times(Mat4.rotation(Math.PI/2, 1, 0, 0)).times(Mat4.scale(5, 5, 1 / 2));

        this.shapes.torus.draw(context, program_state, design_lamp_transform, shadow_pass? this.materials.lamp_head.override({color: color(1, 1, 1, 1)}): this.pure);
        this.shapes.cube.draw(context, program_state, Mat4.translation(30, 0.8, 0).times(lamp_head_transform), shadow_pass? this.materials.lamp_head.override({color: color(1, 1, 1, 1)}): this.pure);
        //this.shapes.cube.draw(context, program_state, lamp_main_transform, shadow_pass? this.materials.lamp_main.override({color:color(204/255, 153/255, 102/255, 1)}): this.pure);

        let ball_transform_1 = this.last_transform_1
        let ball_position_1 = vec4(0, 0, 0, 1)

        ball_position_1 = ball_transform_1.times(ball_position_1)
        let x_1 = ball_position_1[0]
        let y_1 = ball_position_1[1]
        let z_1 = ball_position_1[2]

        // collision detection for the walls
        if (x_1 > -1 && this.d_x_1 === 1){
            this.d_x_1 = -1;
        }
        else if (x_1 < -13.7 && y_1 > -4 && y_1 < 6 && z_1 > -6 && z_1 < 10 && this.d_x_1 === -1) {
            this.d_x_1 = 1; // for screen
        }
        else if (x_1 < -14 && this.d_x_1 === -1){
            this.d_x_1 = 1;
        }
        if (x_1 > -10 && x_1 < -6 && y_1 > 8.7 && this.d_y_1 === 1) {
            this.d_y_1 = -1;
        }
        else if (y_1 > 9 && this.d_y_1 === 1){
            this.d_y_1 = -1;
        }
        else if (y_1 < -7 && this.d_y_1 === -1){
            this.d_y_1 = 1
        }
        if (z_1 > 16 && this.d_z_1 === 1){
            this.d_z_1 = -1
        }
        else if (z_1 < -10 && this.d_z_1 === -1){
            this.d_z_1 = 1
        }

        // collision detection for the control panel
        if (y_1 < -3 && x_1 > -14 && x_1 < -8 && this.d_y_1 === -1){
            this.d_y_1 = 1
        }
        if (y_1 < -3 && x_1 < -8 && this.d_x_1 === -1){
            this.d_x_1 = 1
        }

        // collision detection for the couch
        // for couch seat
        if (y_1 < -5.5 && x_1 > -6.8 && x_1 <= -5 && z_1 >= 2 && z_1 <= 10 && this.d_y_1 === -1){
            this.d_y_1 = 1
        }
        // for couch arm 1
        if (y_1 < -4.5 && x_1 > -6.8 && x_1 <= -5 && z_1 > -1 && z_1 < 2 && this.d_y_1 === -1){
            this.d_y_1 = 1
        } 
        // for couch arm 2
        else if (y_1 < -4.5 && x_1 > -6.8 && x_1 <= -5 && z_1 > 10 && z_1 < 13 && this.d_y_1 === -1){
            this.d_y_1 = 1
        }
        else if (y_1 < -3.5 && x_1 > -5 && x_1 < -2 && z_1 > -1 && z_1 < 13 && this.d_y_1 === -1){
            this.d_y_1 = 1
        }
        // for couch side
        if (y_1 > -7 && y_1 < -4.5 && x_1 > -6 && x_1 < -3 && z_1 > -1 && this.d_z_1 === 1){
            this.d_z_1 = -1
        }
        else if (y_1 > -7 && y_1 < -3.5 && x_1 >= -3 && x_1 < -2 && z_1 > -1 && this.d_z_1 === 1){
            this.d_z_1 = -1
        }
        // for couch back
        if (y_1 > -7 && y_1 < -3.5 && x_1 < -2 && z_1 > -1 && z_1 < 13 && this.d_x_1 === -1){
            this.d_x_1 = 1
        }


        let ball_transform_2 = this.last_transform_2
        let ball_position_2 = vec4(0, 0, 0, 1)

        ball_position_2 = ball_transform_2.times(ball_position_2)
        let x_2 = ball_position_2[0]
        let y_2 = ball_position_2[1]
        let z_2 = ball_position_2[2]

        // collision detection for the walls
        if (x_2 > -1 && this.d_x_2 === 1){
            this.d_x_2 = -1
        }
        else if (x_2 < -13.7 && y_2 > -4 && y_2 < 6 && z_2 > -6 && z_2 < 10 && this.d_x_2 === -1) {
            this.d_x_2 = 1; // for screen
        }
        else if (x_2 < -14 && this.d_x_2 === -1){
            this.d_x_2 = 1
        }
        if (x_2 > -10 && x_2 < -6 && y_2 > 8.7 && this.d_y_2 === 1) {
            this.d_y_2 = -1 // for the light
        }
        else if (y_2 > 9 && this.d_y_2 === 1){
            this.d_y_2 = -1
        }
        else if (y_2 < -7 && this.d_y_2 === -1){
            this.d_y_2 = 1
        }
        if (z_2 > 14 && this.d_z_2 === 1){
            this.d_z_2 = -1
        }
        else if (z_2 < -10 && this.d_z_2 === -1){
            this.d_z_2 = 1
        }

        // collision detection for the control panel
        if (y_2 < -3 && x_2 > -14 && x_2 < -8 && this.d_y_2 === -1){
            this.d_y_2 = 1
        }
        if (y_2 < -3 && x_2 < -8 && this.d_x_2 === -1){
            this.d_x_2 = 1
        }

        // collision detection for the couch
        // for couch seat
        if (y_2 < -5.5 && x_2 > -6.8 && x_2 <= -5 && z_2 >= 2 && z_2 <= 10 && this.d_y_2 === -1){
            this.d_y_2 = 1
        }
        // for couch arm 1
        if (y_2 < -4.5 && x_2 > -6.8 && x_2 <= -5 && z_2 > -1 && z_2 < 2 && this.d_y_2 === -1){
            this.d_y_2 = 1
        } 
        // for couch arm 2
        else if (y_2 < -4.5 && x_2 > -6.8 && x_2 <= -5 && z_2 > 10 && z_2 < 13 && this.d_y_2 === -1){
            this.d_y_2 = 1
        }
        else if (y_2 < -3.5 && x_2 > -5 && x_2 < -2 && z_2 > -1 && z_2 < 13 && this.d_y_2 === -1){
            this.d_y_2 = 1
        }
        if (y_2> -7 && y_2 < -4.5 && x_2 > -6 && x_2 < -3 && z_2 > -1 && this.d_z_2 === 1){
            this.d_z_2 = -1
        }else if (y_2 > -7 && y_2 < -3.5 && x_2 >= -3 && x_2 < -2 && z_2 > -1 && this.d_z_2 === 1){
            this.d_z_2 = -1
        }
        if (y_2 > -7 && y_2 < -3.5 && x_2 < -2 && z_2 > -1 && z_2 < 13 && this.d_x_2 === -1){
            this.d_x_2 = 1
        }
    
        // collision detection between two balls
        let dist = Math.sqrt((y_2 - y_1)** 2 + (x_2 - x_1)** 2 + (z_2 - z_1)** 2);
        //window.alert(dist)
        if (dist <= 2){
            // using conservation of momentum in space to calculate the velocity of objects after collision
            if (this.v_x_1 != this.v_x_2){
                this.v_x_1 = ((this.m_1 - this.m_2) / (this.m_1 + this.m_2)) * this.d_x_1 *this.v_x_1 + ((2 * this.m_2) / (this.m_1 + this.m_2)) * this.d_x_2 * this.v_x_2;
                if (this.v_x_1 <0) {
                    this.v_x_1 = - this.v_x_1;
                    this.d_x_1 = - this.d_x_1;
                }
                this.v_x_2 = ((2 * this.m_1) / (this.m_1 + this.m_2)) * this.d_x_1 * this.v_x_1 + ((this.m_2 - this.m_1) / (this.m_1 + this.m_2)) * this.d_x_2 * this.v_x_2;
                if (this.v_x_2 <0) {
                    this.v_x_2 = - this.v_x_2;
                    this.d_x_2 = - this.d_x_2;
                }
            }
            if (this.v_y_1 != this.v_y_2){
                this.v_y_1 = ((this.m_1 - this.m_2) / (this.m_1 + this.m_2)) * this.d_y_1 * this.v_y_1 + ((2 * this.m_2) / (this.m_1 + this.m_2)) * this.d_y_2 * this.v_y_2;
                if (this.v_y_1 <0) {
                    this.v_y_1 = - this.v_y_1;
                    this.d_y_1 = - this.d_y_1;
                }
                this.v_y_2 = ((2 * this.m_1) / (this.m_1 + this.m_2)) * this.d_y_1 * this.v_y_1 + ((this.m_2 - this.m_1) / (this.m_1 + this.m_2)) * this.d_y_2 * this.v_y_2;
                if (this.v_y_2 <0) {
                    this.v_y_2 = - this.v_y_2;
                    this.d_y_2 = - this.d_y_2;
                }
            }
            if (this.v_z_1 != this.v_z_2){
                this.v_z_1 = ((this.m_1 - this.m_2) / (this.m_1 + this.m_2)) * this.d_z_1 * this.v_z_1 + ((2 * this.m_2) / (this.m_1 + this.m_2)) * this.d_z_2 * this.v_z_2;
                if (this.v_z_1 <0) {
                    this.v_z_1 = - this.v_z_1;
                    this.d_z_1 = - this.d_z_1;
                }
                this.v_z_2 = ((2 * this.m_1) / (this.m_1 + this.m_2))* this.d_z_1 * this.v_z_1 + ((this.m_2 - this.m_1) / (this.m_1 + this.m_2)) * this.d_z_2 * this.v_z_2;
                if (this.v_z_2 <0) {
                    this.v_z_2 = - this.v_z_2;
                    this.d_z_2 = - this.d_z_2;
                }
            }

        };

        ball_transform_1 = ball_transform_1.times(Mat4.translation(this.v_x_1 * this.d_x_1 / 50, this.v_y_1 * this.d_y_1 / 50, this.v_z_1 * this.d_z_1 / 50 ))
        let ball_transform_1_new = ball_transform_1.times(Mat4.rotation(t, 1, 1, 0)).times(Mat4.rotation(t, 0, 0, 1));

        this.last_transform_1 = ball_transform_1
        this.shapes.ball_1.draw(context, program_state, ball_transform_1_new, shadow_pass? this.materials.lamp_main.override({color:hex_color("#d9e0ff")}): this.pure);


        ball_transform_2 = ball_transform_2.times(Mat4.translation(this.v_x_2 * this.d_x_2 / 50, this.v_y_2 * this.d_y_2 / 50, this.v_z_2 * this.d_z_2 / 50))
        let ball_transform_2_new = ball_transform_2.times(Mat4.rotation(t, 1, 0, 0)).times(Mat4.rotation(t, 0, 1, 1));

        this.last_transform_2 = ball_transform_2
        this.shapes.ball_2.draw(context, program_state, ball_transform_2_new, shadow_pass? this.materials.lamp_main.override({color:hex_color("#ff91b4")}): this.pure);


        //draw the screen
        let screen_transform = Mat4.identity();
        screen_transform = screen_transform.times(Mat4.translation(-14.8, 1, 2)).times(Mat4.rotation(Math.PI/2, 0, 1, 0)).times(Mat4.scale(8, 5, 0.1))
        //
        // let strings = ["This is some text"];
        // this.shapes.text.set_string(strings[0], context.context);
        // this.shapes.text.draw(context, program_state,screen_transform , this.text_image);
        let r = Math.floor(t * 1000 % 3600);
        if (r <= 600)
            this.shapes.cube.draw(context, program_state, screen_transform, this.materials.screen_texture1);
        else if (r >= 601 && r <=1200)
            this.shapes.cube.draw(context, program_state, screen_transform, this.materials.screen_texture2);
        else if (r >= 1201 && r<=1800)
            this.shapes.cube.draw(context, program_state, screen_transform, this.materials.screen_texture3);
        else if (r >= 1801)
            this.shapes.cube.draw(context, program_state, screen_transform, this.materials.screen_texture4);

        //control panel
        let control_transform = Mat4.identity();
        control_transform = control_transform.times(Mat4.translation(-12.5, -6.5, 0)).times(Mat4.rotation(Math.PI/2, 0, 1, 0)).times(Mat4.scale(15, 1.5, 2))
        // this.shapes.cube.draw(context, program_state, screen_transform, this.materials.loc1);
        this.shapes.cube.draw(context, program_state, control_transform, shadow_pass? this.materials.control: this.pure);
        // keyboard
        this.shapes.cube.draw(context, program_state, Mat4.translation(-8, -4.5, 5).times(Mat4.scale(1 / 3, 1 / 15, 1 / 5)).times(control_transform), shadow_pass? this.materials.control.override({color: color(1, 1, 1, 1)}): this.pure);
        this.shapes.cube.draw(context, program_state, Mat4.translation(-8, -4.5, 1).times(Mat4.scale(1 / 3, 1 / 15, 1 / 25)).times(control_transform), shadow_pass? this.materials.control.override({color: color(1, 1, 1, 1)}): this.pure);
        this.shapes.cube.draw(context, program_state, Mat4.translation(-8, -4.5, -0.5).times(Mat4.scale(1 / 3, 1 / 15, 1 / 25)).times(control_transform), shadow_pass? this.materials.control.override({color: color(1, 1, 1, 1)}): this.pure);

        // draw desk by window
        this.shapes.cube.draw(context, program_state, Mat4.translation(15, -2, -16).times(Mat4.rotation(Math.PI / 2, 0, 1, 0)).times(Mat4.scale(0.2, 0.2, 0.6)).times(control_transform), shadow_pass? this.materials.wall.override({color:color(1, 1, 1, 1)}): this.pure); // top of desk
        this.shapes.cube.draw(context, program_state, Mat4.translation(15, 5, -16).times(Mat4.rotation(Math.PI / 2, 0, 1, 0)).times(Mat4.scale(0.1, 1.63, 0.03)).times(control_transform), shadow_pass? this.materials.wall.override({color:color(1, 1, 1, 1)}): this.pure);

        // draws wall in middle
        let wall3_model_transform = Mat4.translation(15, 0.08, -1.5).times(Mat4.scale(1, 1, 0.85)).times(wall2_model_transform);
        this.shapes.cube.draw(context, program_state, wall3_model_transform, shadow_pass? this.materials.wall_transp: this.pure);
        // this.shapes.cube.draw(context, program_state, Mat4.translation(0, 0, 13).times(wall3_model_transform), shadow_pass? this.materials.wall_transp: this.pure);
        
        // // draws window
        // this.shapes.cube.draw(context, program_state, Mat4.translation(24, 0, 0).times(Mat4.scale(1.4, 0.62, 1)).times(window3_model_transform), shadow_pass? this.materials.wall_transp.override({color:color(1,1,1,0.06)}):this.pure); //this.shadow:this.materials.wall
        // //this.shapes.cube.draw(context, program_state, window2_model_transform, shadow_pass? this.materials.wall_met:this.pure);
    }

    display(context, program_state) {
        const t = program_state.animation_time, dt = program_state.animation_delta_time / 1000;
        const gl = context.context;

        if (!this.init_ok) {
            const ext = gl.getExtension('WEBGL_depth_texture');
            if (!ext) {
                return alert('need WEBGL_depth_texture');  // eslint-disable-line
            }
            this.texture_buffer_init(gl);

            this.init_ok = true;
        }

        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(Mat4.translation(-5, 0, -30)); // Locate the camera here
        }

        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, 1, 100);

        // The position of the light
        this.light_position = Mat4.rotation(t / 1500, 0, 1, 0).times(vec4(3, 6, 0, 1));
        // The color of the light
        this.light_color = color(1, 1, 1, 1);

        // This is a rough target of the light.
        // Although the light is point light, we need a target to set the POV of the light
        this.light_view_target = vec4(0, 0, 0, 1);
        this.light_field_of_view = 150 * Math.PI / 180; // 130 degree

        program_state.lights = [new Light(this.light_position, this.light_color, 1000)];

        // Step 1: set the perspective and camera to the POV of light
        const light_view_mat = Mat4.look_at(
            vec3(this.light_position[0], this.light_position[1], this.light_position[2]),
            vec3(this.light_view_target[0], this.light_view_target[1], this.light_view_target[2]),
            vec3(0, 1, 0), // assume the light to target will have a up dir of +y, maybe need to change according to your case
        );
        const light_proj_mat = Mat4.perspective(this.light_field_of_view, 1, 0.5, 500);
        // Bind the Depth Texture Buffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.lightDepthFramebuffer);
        gl.viewport(0, 0, this.lightDepthTextureSize, this.lightDepthTextureSize);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        // Prepare uniforms
        program_state.light_view_mat = light_view_mat;
        program_state.light_proj_mat = light_proj_mat;
        program_state.light_tex_mat = light_proj_mat;
        program_state.view_mat = light_view_mat;
        program_state.projection_transform = light_proj_mat;
        this.render_scene(context, program_state, false,false, false);

        // Step 2: unbind, draw to the canvas
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        program_state.view_mat = program_state.camera_inverse;
        program_state.projection_transform = Mat4.perspective(Math.PI / 4, context.width / context.height, 0.5, 500);
        this.render_scene(context, program_state, true,true, true);

    }

}

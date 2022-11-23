import {defs, tiny} from './examples/common.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Matrix, Mat4, Light, Shape, Material, Scene,Texture,
} = tiny;
const { Textured_Phong } = defs

class Cube extends Shape {
    constructor() {
        super("position", "normal",);
        // Loop 3 times (for each axis), and inside loop twice (for opposing cube sides):
        this.arrays.position = Vector3.cast(
            [-1, -1, -1], [1, -1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, -1], [-1, 1, -1], [1, 1, 1], [-1, 1, 1],
            [-1, -1, -1], [-1, -1, 1], [-1, 1, -1], [-1, 1, 1], [1, -1, 1], [1, -1, -1], [1, 1, 1], [1, 1, -1],
            [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1], [1, -1, -1], [-1, -1, -1], [1, 1, -1], [-1, 1, -1]);
        this.arrays.normal = Vector3.cast(
            [0, -1, 0], [0, -1, 0], [0, -1, 0], [0, -1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0],
            [-1, 0, 0], [-1, 0, 0], [-1, 0, 0], [-1, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0],
            [0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, -1], [0, 0, -1], [0, 0, -1], [0, 0, -1]);
        // Arrange the vertices into a square shape in texture space too:
        this.indices.push(0, 1, 2, 1, 3, 2, 4, 5, 6, 5, 7, 6, 8, 9, 10, 9, 11, 10, 12, 13,
            14, 13, 15, 14, 16, 17, 18, 17, 19, 18, 20, 21, 22, 21, 23, 22);
    }
}

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



class Base_Scene extends Scene {
    /**
     *  **Base_scene** is a Scene that can be added to any display canvas.
     *  Setup the shapes, materials, camera, and lighting here.
     */
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();
        // At the beginning of our program, load one of each of these shape definitions onto the GPU.
        this.colors = [hex_color("#FFFFFF"),hex_color("#FFFFCC"),hex_color("#FFFF99"),hex_color("#FFFF66"),hex_color("#FFFF33"),hex_color("#FFFF00"),hex_color("#FFCC99"),hex_color("#FFCC66"),hex_color("#FFCC33"),hex_color("#FFCC00")];
        this.shapes = {
            'cube': new Cube(),
            'lamp': new defs.Torus(3, 9),
            'ball_1': new defs.Regular_2D_Polygon(1, 15),
            'ball_2': new defs.Subdivision_Sphere(4),
            'ball_3': new (defs.Subdivision_Sphere.prototype.make_flat_shaded_version())(1),
            'alien': new Shape_From_File("assets/alien.obj"),
            'capsul': new Shape_From_File("assets/capsul.obj"),
            'robot': new Shape_From_File("assets/robot.obj"),
            'spacecar': new Shape_From_File("assets/spacecar.obj"),
        };
        // *** Materials
        const textured = new defs.Textured_Phong(1);
        this.materials = {
            wood: new Material(new defs.Phong_Shader(),
                {ambient: .8, diffusivity: .6, color: hex_color("#BA8C63")}),
            couch: new Material(new defs.Phong_Shader(),
                {ambient: .8, diffusivity: .5, color: hex_color("7393B3")}),
            wall: new Material(new defs.Phong_Shader(),
                {ambient: 0.8, diffusivity: 0.3, color: hex_color("#bcbab5")}),
            screen: new Material(new defs.Phong_Shader(),
                {ambient: 0.8, diffusivity: 0.3, color: hex_color("#6B8E23")}),
            lamp_head:new Material(new defs.Phong_Shader(),
                {ambient: 0.8, diffusivity: 0.3, color: hex_color("#FFB6C1")}),
            lamp_main:new Material(new defs.Phong_Shader(),
                {ambient: 0.8, diffusivity: 0.3, color: hex_color("#666666")}),
            loc1: new Material(new Texture_Rotate(), {
                color: hex_color("#6B8E23"),
                ambient: 1, diffusivity: 0.1,
                texture: new Texture("assets/loc_05.png", "NEAREST")
            }),
            alien_texture: new Material(textured, {
                ambient: 0.1, diffusivity: 0.5,
                texture: new Texture("assets/alien.png"),
                color: color(0, 0, 0, 1)
            }),
            capsul_texture: new Material(textured, {
                ambient: 0.1, diffusivity: 0.5,
                texture: new Texture("assets/capsul.png"),
                color: color(0, 0, 0, 1)
            }),
           robot_texture: new Material(textured, {
                ambient: 0.1, diffusivity: 0.5,
                texture: new Texture("assets/robot.png"),
                color: color(0, 0, 0, 1)
            }),
            spacecar_texture: new Material(textured, {
                ambient: 0.1, diffusivity: 0.5,
                texture: new Texture("assets/spacecar.png"),
                color: color(0, 0, 0, 1)
            })

        };
    }

    display(context, program_state) {
        // display():  Called once per frame of animation. Here, the base class's display only does
        // some initial setup.

        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(Mat4.translation(5, -10, -30));
        }
        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, 1, 100);

        // *** Lights: *** Values of vector or point lights.
        const light_position = vec4(0, 5, 5, 1);
        program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 1000)];
    }
}

export class chair_scene extends Base_Scene {
    /**
     * This Scene object can be added to any display canvas.
     * We isolate that code so it can be experimented with on its own.
     * This gives you a very small code sandbox for editing a simple scene, and for
     * experimenting with matrix transformations.
     */

    //if need control panel for chair add here
    constructor(){
        super();
        var otl = this.otl = 0
    }


    display(context, program_state) {
        super.display(context, program_state);

        //draw chair
        let chair_model_transform = Mat4.identity();
        //move chair to designated location
        chair_model_transform = chair_model_transform.times(Mat4.translation(4, -3, -5))
            .times(Mat4.rotation(Math.PI*3/2,0, 1, 0));

        //draw chair legs
        let leg_transform_1 = chair_model_transform.times(Mat4.translation(0, -4.1, 0)).times(Mat4.translation(-1, 0, -1))
            .times(Mat4.scale(0.25, 1, 0.25));
        let leg_transform_2 = chair_model_transform.times(Mat4.translation(0, -4.1, 0)).times(Mat4.translation(1, 0, -1))
            .times(Mat4.scale(0.25, 1, 0.25));
        let leg_transform_3 = chair_model_transform.times(Mat4.translation(0, -4.1, 0)).times(Mat4.translation(-1, 0, 1))
            .times(Mat4.scale(0.25, 1, 0.25));
        let leg_transform_4 = chair_model_transform.times(Mat4.translation(0, -4.1, 0)).times(Mat4.translation(1, 0, 1))
            .times(Mat4.scale(0.25, 1, 0.25));

        //draw chair seat
        let seat_transform = chair_model_transform.times(Mat4.translation(0, -4.1, 0)).times(Mat4.translation(0, 1, 0))
            .times(Mat4.scale(1.2, 0.25, 1.2));

        //draw chair back
        let back_transform = chair_model_transform.times(Mat4.translation(0, -4.1, 0)).times(Mat4.translation(0,2,-1))
            .times(Mat4.scale(1.2,1.2,0.25));

        //draw alien
        let alien_transform = Mat4.identity();
        alien_transform = alien_transform.times(Mat4.translation(8, -3, -5));
        this.shapes.alien.draw(context, program_state, alien_transform, this.materials.alien_texture);

        //draw alien
        let capsul_transform = Mat4.identity();
        capsul_transform = capsul_transform.times(Mat4.translation(8, -7, -5));
        this.shapes.capsul.draw(context, program_state, capsul_transform, this.materials.capsul_texture);

        //draw alien
        let robot_transform = Mat4.identity();
        robot_transform = robot_transform.times(Mat4.translation(6, -3, -5));
        this.shapes.robot.draw(context, program_state, robot_transform, this.materials.robot_texture);

        //draw alien
        let spacecar_transform = Mat4.identity();
        spacecar_transform = spacecar_transform.times(Mat4.translation(4, -3, -5));
        this.shapes.spacecar.draw(context, program_state, spacecar_transform, this.materials.spacecar_texture);

        this.shapes.cube.draw(context, program_state, leg_transform_1, this.materials.wood);
        this.shapes.cube.draw(context, program_state, leg_transform_2, this.materials.wood);
        this.shapes.cube.draw(context, program_state, leg_transform_3, this.materials.wood);
        this.shapes.cube.draw(context, program_state, leg_transform_4, this.materials.wood);
        this.shapes.cube.draw(context, program_state, seat_transform, this.materials.wood);
        this.shapes.cube.draw(context, program_state, back_transform, this.materials.wood);

        //draw couch
        let couch_model_transform = Mat4.identity();
        //move chair to designated location
        couch_model_transform = couch_model_transform.times(Mat4.translation(-5, -3.75, 6)).times(Mat4.translation(10, 0, 3))
            .times(Mat4.rotation(Math.PI*3/2,0, 1, 0));
        //couch lower cushion
        let couch_lower_transform = couch_model_transform.times(Mat4.translation(-5, -3.75, 6)).times(Mat4.scale(6, 0.5, 1));
        //couch top cushion
        let couch_top_transform = couch_model_transform.times(Mat4.translation(-5, -3.75, 6)).times(Mat4.translation(0,0.75,0))
            .times(Mat4.scale(6, 0.25, 1));
        //couch back
        let couch_back_transform = couch_model_transform.times(Mat4.translation(-5, -3.5, 6)).times(Mat4.translation(0,1,-1.5))
            .times(Mat4.scale(6, 1.825, 0.5));
        //couch arm right
        let couch_arm_1_transform = couch_model_transform.times(Mat4.translation(-5, -3.75, 6)).times(Mat4.translation(5.5,.75,0))
            .times(Mat4.scale(0.5, 1.3,1));
        //couch arm left
        let couch_arm_2_transform = couch_model_transform.times(Mat4.translation(-5, -3.75, 6)).times(Mat4.translation(-5.5,.75,0))
            .times(Mat4.scale(0.5, 1.3,1));

        this.shapes.cube.draw(context, program_state, couch_lower_transform, this.materials.couch);
        this.shapes.cube.draw(context, program_state, couch_top_transform, this.materials.couch);
        this.shapes.cube.draw(context, program_state, couch_back_transform, this.materials.couch);
        this.shapes.cube.draw(context, program_state, couch_arm_1_transform, this.materials.couch);
        this.shapes.cube.draw(context, program_state, couch_arm_2_transform, this.materials.couch);

        // draws the wall with window
        let window_model_transform = Mat4.identity();
        let window1_model_transform = window_model_transform.times(Mat4.translation(10, -8, -15)).times(Mat4.scale(15, 2, 0.1))
        let window2_model_transform = window_model_transform.times(Mat4.translation(10, 8, -15)).times(Mat4.scale(15, 2, 0.1))
        let window3_model_transform = window_model_transform.times(Mat4.translation(-10, 0, -15)).times(Mat4.scale(5, 10, 0.1))
        let window4_model_transform = window_model_transform.times(Mat4.translation(30, 0, -15)).times(Mat4.scale(8, 10, 0.1))

        this.shapes.cube.draw(context, program_state, window1_model_transform, this.materials.wall);
        this.shapes.cube.draw(context, program_state, window2_model_transform, this.materials.wall);
        this.shapes.cube.draw(context, program_state, window3_model_transform, this.materials.wall);
        this.shapes.cube.draw(context, program_state, window4_model_transform, this.materials.wall);

        // draws the walls on the ends
        let wall_model_transform = Mat4.identity();
        let wall1_model_transform = wall_model_transform.times(Mat4.translation(38, 0, 0)).times(Mat4.rotation(Math.PI/2, 0, 1, 0)).times(Mat4.scale(15, 10, 0.1));

        this.shapes.cube.draw(context, program_state, wall1_model_transform, this.materials.wall);

        let wall2_model_transform = wall_model_transform.times(Mat4.translation(-15, 0, 0)).times(Mat4.rotation(Math.PI/2, 0, 1, 0)).times(Mat4.scale(15, 10, 0.1));

        this.shapes.cube.draw(context, program_state, wall2_model_transform, this.materials.wall.override({color:hex_color("#999999")}));


        // draws the roof
        let roof_model_transform = Mat4.identity();
        roof_model_transform = roof_model_transform.times(Mat4.translation(11, 10, 0)).times(Mat4.rotation(Math.PI/2, 1, 0, 0)).times(Mat4.scale(27, 16, 0.1))

        this.shapes.cube.draw(context, program_state, roof_model_transform, this.materials.wall);

        // draws the floor
        let floor_model_transform = Mat4.identity();
        floor_model_transform = floor_model_transform.times(Mat4.translation(11, -8, 0)).times(Mat4.rotation(Math.PI/2, 1, 0, 0)).times(Mat4.scale(27, 16, 0.1))
        this.shapes.cube.draw(context, program_state, floor_model_transform, this.materials.wall.override({color:hex_color("#666666")}));

        //draw the lamp
        let lamp_head_transform = Mat4.identity();
        let lamp_main_transform = Mat4.identity();
        lamp_head_transform =  lamp_head_transform.times(Mat4.translation(-5, 0, 0)).times(Mat4.rotation(Math.PI/2, 1, 0, 0)).times(Mat4.scale(4, 4, 0.1))
        //let lamp_head_inner_transform =  lamp_head_transform.times(Mat4.scale(1.5, 1.5, 0.1))
        lamp_main_transform =  lamp_main_transform.times(Mat4.translation(-5, -5, 0)).times(Mat4.rotation(Math.PI/2, 1, 0, 0)).times(Mat4.scale(0.2, 0.2, 4))

        //this.shapes.lamp.draw(context, program_state, lamp_head_transform, this.materials.lamp_head);
        let t = program_state.animation_time / 1000.0;
        let choice = Math.floor(t * 1000 % 8);
        this.shapes.lamp.draw(context, program_state,  lamp_head_transform, this.materials.lamp_head.override({color: this.colors[choice]}));

        this.shapes.cube.draw(context, program_state, lamp_main_transform, this.materials.lamp_main.override({color:hex_color("#CC9966")}));

        //draw all the floating ball
        let ball1_transform = Mat4.identity();
        ball1_transform =  ball1_transform.times(Mat4.translation(3, 0, 0)).times(Mat4.rotation(t , 0, 1, 0))
            .times(Mat4.translation(2, 0, 0))
            .times(Mat4.rotation(t  , 0, 1, 0))
            .times(Mat4.translation(0, -1, 0))
            .times(Mat4.rotation(t , 1, 0, 0))
            .times(Mat4.translation(0, 1, 0))
            .times(Mat4.rotation(t , 0, 1, 0));
        this.shapes.ball_1.draw(context, program_state, ball1_transform, this.materials.lamp_main.override({color:hex_color("#CCFFFF")}));



        //draw the screen
        let screen_transform = Mat4.identity();
        screen_transform = screen_transform.times(Mat4.translation(-14.5, 1, 2)).times(Mat4.rotation(Math.PI/2, 0, 1, 0)).times(Mat4.scale(8, 5, 0.1))
       // this.shapes.cube.draw(context, program_state, screen_transform, this.materials.loc1);
        this.shapes.cube.draw(context, program_state, screen_transform, this.materials.screen);


        //draw the control panel
        let control_transform = Mat4.identity();
        control_transform = control_transform.times(Mat4.translation(-14.5, -6, 1.8)).times(Mat4.rotation(Math.PI/2, 0, 1, 0)).times(Mat4.scale(12, 2, 5))
       // this.shapes.cube.draw(context, program_state, screen_transform, this.materials.loc1);
        this.shapes.cube.draw(context, program_state, control_transform, this.materials.wall.override({color:hex_color("#000033")}));
        //
        // let x = screen_transform[0][3];
        // let y = screen_transform[1][3];
        // let z = screen_transform[2][3];
        // let string = x.toString()+y.toString()+z.toString();


        // function show() {
        //     document.getElementById('result').innerText = string;
        //
        // }
        // let r = Math.random() * 100;
        // if (0 <r <= 25)
       // this.shapes.cube.draw(context, program_state, screen_transform, this.materials.loc1);
        // else if (25 <r <= 50)
        //     this.shapes.cube.draw(context, program_state, screen_transform, this.materials.loc2);
        // else if (50 <r <= 75)
        //     this.shapes.cube.draw(context, program_state, screen_transform, this.materials.loc3);
        // else if (75 <r <= 100)
        //     this.shapes.cube.draw(context, program_state, screen_transform, this.materials.loc4);

    }
}

class Texture_Scroll_X extends Textured_Phong {
    // TODO:  Modify the shader below (right now it's just the same fragment shader as Textured_Phong) for requirement #6.
    fragment_glsl_code() {
        return this.shared_glsl_code() + `
            varying vec2 f_tex_coord;
            uniform sampler2D texture;
            uniform float animation_time;
            
            void main(){
                mat4 tx = mat4(vec4(-1., 0., 0., 0.), vec4(0., 1., 0., 0.), vec4(0., 0., 0., 0.), vec4(mod(2.0 * animation_time, 60.0) , 0., 0., 0.)); 
                vec4 scroll_vec = vec4(f_tex_coord, 0., 0.);
                scroll_vec =  tx * (scroll_vec + vec4(1., 1., 0., 1.)); 
                vec2 scaled_scroll_vec = vec2(scroll_vec.x * 2., scroll_vec.y * 2.);
                vec4 tex_color = texture2D(texture, scaled_scroll_vec);
                float x = mod(scaled_scroll_vec.x, 1.0);
                float y = mod(scaled_scroll_vec.y, 1.0);
                if (((x >= 0.15 && x <= 0.25) && (y >= 0.15 && y <= 0.85)) || // left edge
                    ((x >= 0.15 && x <= 0.85) && (y >= 0.15 && y <= 0.25)) || // bottom edge
                    ((x >= 0.15 && x <= 0.85) && (y >= 0.75 && y <= 0.85)) || // top edge
                    ((x >= 0.75 && x <= 0.85) && (y >= 0.15 && y <= 0.85)))  {
                    tex_color = vec4(0, 0, 0, 1.0);
                }
                // Sample the texture image in the correct place:
                if( tex_color.w < .01 ) discard;
                                                                         // Compute an initial (ambient) color:
                gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w ); 
                                                                         // Compute the final color with contributions from lights:
                gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
        } `;
    }
}


class Texture_Rotate extends Textured_Phong {
    // TODO:  Modify the shader below (right now it's just the same fragment shader as Textured_Phong) for requirement #7.
    fragment_glsl_code() {
        return this.shared_glsl_code() + `
            varying vec2 f_tex_coord;
            uniform sampler2D texture;
            uniform float animation_time;
            void main(){
                // calculate rotate matrix  
                vec2 new_tex = f_tex_coord + vec2(-0.5, -0.5);
                float angle = 0.5 * -3.14159 * mod(animation_time, 4.0);
                mat2 rot = mat2(cos(angle), sin(angle), -sin(angle), cos(angle));
                new_tex = rot * new_tex + vec2(0.5, 0.5);
                vec4 tex_color = texture2D(texture, new_tex); 
                // black out square
                float x = mod(new_tex.x, 1.0);
                float y = mod(new_tex.y, 1.0);
                if (((x >= 0.15 && x <= 0.25) && (y >= 0.15 && y <= 0.85)) || // left edge
                    ((x >= 0.15 && x <= 0.85) && (y >= 0.15 && y <= 0.25)) || // bottom edge
                    ((x >= 0.15 && x <= 0.85) && (y >= 0.75 && y <= 0.85)) || // top edge
                    ((x >= 0.75 && x <= 0.85) && (y >= 0.15 && y <= 0.85))) {
                    tex_color = vec4(0, 0, 0, 1.0);
                }
                // Sample the texture image in the correct place:
                if( tex_color.w < .01 ) discard;
                                                                         // Compute an initial (ambient) color:
                gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w ); 
                                                                         // Compute the final color with contributions from lights:
                gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
        } `;
    }
}

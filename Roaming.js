import {defs, tiny} from './examples/common.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;

export class Roaming extends Scene {
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();
        this.center =  Mat4.identity().times(Mat4.translation(-15,-9,0));

        // At the beginning of our program, load one of each of these shape definitions onto the GPU.
        this.shapes = {
            triangle: new defs.Triangle(),
        };

        // *** Materials
        this.materials = {
            background: new Material(new defs.Phong_Shader(),
                {ambient: 1, diffusivity: 1, color: hex_color("#ffffff")}),
        }

        this.initial_camera_location = Mat4.look_at(vec3(0, 10, 20), vec3(0, 0, 0), vec3(0, 1, 0));
    }

    make_control_panel() {
        // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
        this.key_triggered_button("View solar system", ["Control", "0"], () => this.attached = () => this.initial_camera_location);
        // this.new_line();
        // this.key_triggered_button("View the inner spaceship", ["Control", "1"], () => this.attached = () => null);
        // this.new_line();
        // this.key_triggered_button("View the location of spaceship", ["Control", "2"], () => this.attached = () => null);
        // this.new_line();
        // this.key_triggered_button("View the outer spaceship", ["Control", "3"], () => this.attached = () => null);
    }

    display(context, program_state) {
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

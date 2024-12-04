import postgres from "postgres";
import Router from "../router/Router";
import Request from "../router/Request";
import Response, { StatusCode } from "../router/Response";
import User from "../models/User";
import Cookie from "../auth/Cookie";

export default class AuthController {
	private sql: postgres.Sql<any>;

	constructor(sql: postgres.Sql<any>) {
		this.sql = sql;
	}

	registerRoutes(router: Router) {
		router.get("/register", this.getRegistrationForm);
		router.get("/login", this.getLoginForm);
		router.post("/login", this.login);
		router.get("/logout", this.logout);
	}

	getRegistrationForm = async (req: Request, res: Response) => {
		let session = req.session;
		res.setCookie(new Cookie("session_id", session.id));
		let errorMessage = req.getSearchParams().get('error');

		await res.send({
			statusCode: StatusCode.OK,
			template: "RegisterFormView",
			message: "getting form",
			payload: {error: errorMessage}
		});
	};

	getLoginForm = async (req: Request, res: Response) => {
		let session = req.session;
		res.setCookie(new Cookie("session_id", session.id));
		let errorMessage = req.getSearchParams().get('error')
		await res.send({
			statusCode: StatusCode.OK,
			template: "LoginFormView",
			message: "getting form",
			payload: { error: errorMessage }
		});
	};

	login = async (req: Request, res: Response) => {
		let email = req.body.email;
		let password = req.body.password;
		let remember = req.body.remember;

		if(!email){
			await res.send({
				statusCode: StatusCode.BadRequest,
				message: "no email",
				redirect: "/login?error=Email is required"
			});
			return;
		}
		try{
			let user = await User.login(this.sql, email, password)
			if(user){
				let session = req.session;
				session.set("isLoggedIn", true);
				session.set("userId", user.props.id);
				if(user.props.isAdmin){
					session.set("isAdmin", true);
				}
				else{
					session.set("isAdmin", false)
				}
				res.setCookie(new Cookie("session_id", session.id));
				if(remember){
					res.setCookie(new Cookie("email", email));
				}
				await res.send({
					statusCode: StatusCode.OK,
					message: "Logged in successfully!",
					redirect: "/poems",
					payload: {user: user.props}
				});
			}
		}
		catch(error){
			await res.send({
				statusCode: StatusCode.BadRequest,
				message: "Invalid credentials.",
				redirect: "/login?error=Invalid credentials"
			});
			return;
		}
	};

	logout = async (req: Request, res: Response) => {
		try {

            let session = req.session;
            if (session) {
                session.destroy();
            }

            await res.send({
				statusCode: StatusCode.OK,
				redirect: "/",
				message: "User logged out"
			});
        } catch (error) {
			await res.send({
				statusCode: StatusCode.InternalServerError,
				message: "Error logging out"
			});
        }
    }

}

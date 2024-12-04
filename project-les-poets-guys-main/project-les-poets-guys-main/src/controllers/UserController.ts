import postgres from "postgres";
import Request from "../router/Request";
import Response, { StatusCode } from "../router/Response";
import Router from "../router/Router";
import User, { DuplicateEmailError, UserProps } from "../models/User";
import { createUTCDate } from "../utils";
import { userInfo } from "os";
import Poem from "../models/Poem";
import Like from "../models/Like";
/**
 * Controller for handling User CRUD operations.
 * Routes are registered in the `registerRoutes` method.
 * Each method should be called when a request is made to the corresponding route.
 */
export default class UserController {
	private sql: postgres.Sql<any>;

	constructor(sql: postgres.Sql<any>) {
		this.sql = sql;
	}

	registerRoutes(router: Router) {
		router.post("/users", this.createUser);
		router.get("/users", this.usersForm);
		router.get("/users/:id", this.getUserProfile);
		router.delete("/users/:id", this.deleteUser);
		router.put("/users/:id", this.userAsAdmin);
	}

	createUser = async (req: Request, res: Response) => {
		let user: User | null = null;
		let email = req.body.email;
		let password = req.body.password;
		let confirmPassword = req.body.confirmPassword;
		if (!email) {
 			await res.send({
				statusCode: StatusCode.BadRequest,
				message: "Missing email.",
				redirect: "/register?error=Email is required",
			});
			return;
		}
		else if(!password){
			await res.send({
				statusCode: StatusCode.BadRequest,
				message: "Missing password.",
				redirect: "/register?error=password empty"
			});
			return;
		}
		else if(password !== confirmPassword){
			await res.send({
				statusCode: StatusCode.BadRequest,
				message: "Passwords do not match",
				redirect: "/register?error=Passwords do not match"
			});
			return;
		}
		let userProps : UserProps = {
			email: req.body.email,
			password: req.body.password,
			createdAt: createUTCDate(),
			isAdmin: false
		};
		try{
			user = await User.create(this.sql, userProps);
		}
		catch(error){
			if(error instanceof DuplicateEmailError){
				await res.send({
					statusCode: StatusCode.BadRequest,
					message: "User with this email already exists.",
					redirect: "/register?error=email used"
				});
				return;
			}
			else{
				await res.send({
					statusCode: StatusCode.InternalServerError,
					message: "Error creating users, " + error,
					redirect: "/register?error=creating user"
				});
				return;
			}
		}
		await res.send({
			statusCode: StatusCode.Created,
			message: "User created",
			redirect: "/login",
			payload: {user: user?.props}
		});
 	};
	deleteUser = async (req:Request, res: Response) => {
		let id = req.getId()
		let user: User | null = null;
		let admin = req.session.get('isAdmin');
		let loggedIn = req.session.get('isLoggedIn');

		if(!admin || !loggedIn){
			await res.send({
				statusCode: StatusCode.Forbidden,
				message: "Unauthorized",
			});
			return;
		}
		try {
			user = await User.read(this.sql, id);
		} catch (error) {
			await res.send({
				statusCode : StatusCode.InternalServerError,
				message: "error deleting user",
				template: "ErrorFormView"
			});
			return;
		}

		try {
			await user?.delete();
		} catch (error) {
			await res.send({
				statusCode : StatusCode.InternalServerError,
				message: "error deleting user",
				template: "ErrorFormView"
			});
			return;
		}

		await res.send({
			statusCode: StatusCode.OK,
			message: "User deleted",
			payload: { user: user?.props },
			redirect: "/users?deleteMessage=User deleted successfully!"
		});
	};
	usersForm = async (req: Request, res: Response) => {
		let loggedIn = req.session.get('isLoggedIn');
		let admin = req.session.get('isAdmin');
		let messageDelete = req.getSearchParams().get('deleteMessage');
		if(!loggedIn){
			await res.send({
				statusCode: StatusCode.Forbidden,
				message: "Unauthorized",
				redirect: "/login"
			});
			return;
		}
		if(!admin){
			await res.send({
				statusCode: StatusCode.Forbidden,
				message: "Unauthorized",
				template: "AdminFormView",
				payload: {isAdmin: false, isLoggedIn: loggedIn}
			});
			return;
		}
		
		let users = await User.readAll(this.sql);
		await res.send({
			statusCode: StatusCode.OK,
			message: "All users",
			template: "AdminFormView",
			payload: { users: users.map((user) => user.props), isLoggedIn: loggedIn, message: messageDelete, isAdmin: admin },
		});
	}
	getUserProfile = async (req: Request, res: Response) => {
		let loggedIn = req.session.get('isLoggedIn');
		let userId = req.session.get("userId");
		let createdPoems: Poem[] = [];
		let likesGiven: Like[] = [];
		let user 
		if(!loggedIn){
			await res.send({
				statusCode: StatusCode.Unauthorized,
				message: "Unauthorized",
				redirect: "/login"
			});
			return;
		}

		try {
			user = await User.read(this.sql, userId)
		} catch(error) {
			const message = `Error while getting user: ${error}`;
			await res.send({
				statusCode : StatusCode.InternalServerError,
				message: message,
				template: "ErrorFormView"
			});
			return
		}

		try {
			createdPoems = await Poem.readAllFromUserId(this.sql, userId);
		} catch (error) {
			const message = `Error while getting poem list: ${error}`;
			await res.send({
				statusCode : StatusCode.InternalServerError,
				message: message,
				template: "ErrorFormView"
			});
			return
		}
		try {
			likesGiven = await Like.readAllOfUser(this.sql, userId);
		} catch (error) {
			const message = `Error while getting like list: ${error}`;
			await res.send({
				statusCode : StatusCode.InternalServerError,
				message: message,
				template: "ErrorFormView"
			});
			return
		}
		const poemList = createdPoems.map((poem) => {
			return {
				...poem.props
			};
		});
		console.log(poemList)
		const likePoemList = await Promise.all(likesGiven.map(async (like) => {
			let likePoem = await Poem.read(this.sql, like.props.poemId);
			if(likePoem){
				return likePoem.props
			}
			else{
				return null;
			}
		}));
 
		console.log(likePoemList)
		await res.send({
			statusCode: StatusCode.OK,
			message: "Your Profile",
			template: "ProfileView",
			payload: { createdPoems: poemList, likePoems: likePoemList, title: "Your Profile", isLoggedIn: loggedIn, userId: userId, user: user?.props },
		});
	};
	userAsAdmin = async (req: Request, res: Response) => {
		let id = req.getId();
		let user: User | null = null;
		let admin = req.session.get('isAdmin');
		let loggedIn = req.session.get('isLoggedIn');
		if(!admin || !loggedIn){
			await res.send({
				statusCode: StatusCode.Forbidden,
				message: "Unauthorized"
			});
			return;
		}
		try {
			user = await User.read(this.sql, id);
		} catch (error) {
			await res.send({
				statusCode : StatusCode.NoContent,
				message: "error deleting user",
				template: "ErrorFormView"
			});
			return;
		}

        try {
            await user?.toggleAdmin();
            await res.send({
                statusCode: StatusCode.OK,
                message: "User updated",
				payload: {user: user?.props}
            });
        } catch (error) {
            console.error("Error setting admin privileges:", error);
            await res.send({
                statusCode: StatusCode.InternalServerError,
                message: "Error setting admin privileges.",
				template: "ErrorFormView"
            });
        }
	}
}

import Comment, { CommentProps } from "../models/Comment";
import Category, { CategoryProps } from "../models/Categories";
import Poem, { PoemProps } from "../models/Poem";
import postgres from "postgres";
import Request from "../router/Request";
import Response, { StatusCode } from "../router/Response";
import Router from "../router/Router";
import { createUTCDate } from "../utils";
import { runInNewContext } from "vm";
import Like, { LikeProps } from "../models/Like";


export default class PoemController {
	private sql: postgres.Sql<any>;

	constructor(sql: postgres.Sql<any>) {
		this.sql = sql;
	}


	registerRoutes(router: Router) {
		router.get("/poems", this.getPoemList);
		router.get("/poems/new", this.getNewPoemForm);
		router.post("/poems", this.createPoem);

		// Any routes that include an `:id` parameter should be registered last.
		router.get("/poems/:id/edit", this.getEditPoemForm);
		router.post("/poems/:id/likes", this.createLike);
		router.get("/poems/comments/:id/edit", this.getEditCommentForm);
		router.put("/poems/:id/comments/:id", this.updateComment);
		router.delete("/poems/:id/comments/:id", this.deleteComment);
		router.get("/poems/:id", this.getPoem);
		router.post("/poems/:id/comments", this.createComment);
		router.put("/poems/:id", this.updatePoem);
		router.delete("/poems/:id", this.deletePoem);
	}

	getNewPoemForm = async (req: Request, res: Response) => {
		let loggedIn = req.session.get('isLoggedIn');
		if(!loggedIn){
			await res.send({
				statusCode: StatusCode.Unauthorized,
				message: "Unauthorized",
				redirect: "/login"
			});
			return;
		}
		await res.send({
			statusCode: StatusCode.OK,
			message: "New poem form",
			template: "NewFormView",
			payload: { title: "New Poem", isLoggedIn: loggedIn },
		});
	};

	getEditPoemForm = async (req: Request, res: Response) => {
		const id = req.getId();
		let poem : Poem | null = null;
		let userId = req.session.get("userId");

		let loggedIn = req.session.get('isLoggedIn');
		if(!loggedIn){
			await res.send({
				statusCode: StatusCode.Unauthorized,
				message: "Unauthorized",
				redirect: "/login"
			});
			return;
		}
		try {
			poem = await Poem.read(this.sql, id);
		} catch (error) {
			const message = `Error while getting poem list: ${error}`;
			await res.send({
				statusCode : StatusCode.InternalServerError,
				message: message,
				template: "ErrorFormView"
			});
			return;
		}
		if (userId !== poem?.props.userId){
			await res.send({
				statusCode: StatusCode.Unauthorized,
				message: "Unauthorized",
				template: "ErrorFormView"
			});
			return;
		}
		await res.send({
			statusCode: StatusCode.OK,
			message: "Edit poem form",
			template: "EditPoemFormView",
			payload: { poem: poem?.props, title: "Edit Poem", isLoggedIn: loggedIn, userId: userId },
		});
	};


	getPoemList = async (req: Request, res: Response) => {
		let poems: Poem[] = [];
		let userId = req.session.get("userId");
		let sort = req.getSearchParams().get("sortBy")
		let category: Category | null = null
		let loggedIn = req.session.get('isLoggedIn');
		if (sort){
			try{
				category = await Category.getCategory(this.sql, sort);
				poems = await Poem.readAll(this.sql, category?.props.id);
			}
			catch (error) {
				const message = `Error while getting category: ${error}`;
				await res.send({
					statusCode : StatusCode.InternalServerError,
					message: message,
					template: "ErrorFormView"
				});
				return
			}
		}
		else{
			try {
				poems = await Poem.readAll(this.sql);
			} catch (error) {
				const message = `Error while getting poem list: ${error}`;
				await res.send({
					statusCode : StatusCode.InternalServerError,
					message: message,
					template: "ErrorFormView"
				});
				return
			}
		}

		const poemList = poems.map((poem) => {
			return {
				...poem.props
			};
		});

		await res.send({
			statusCode: StatusCode.OK,
			message: "Poem list retrieved",
			payload: {
				title: "Poem List",
				poems: poemList,
				isLoggedIn: loggedIn,
				userId: userId
			},
			template: "ListView",
		});
	};

	getPoem = async (req: Request, res: Response) => {
		const id = req.getId();
		let userId = req.session.get("userId");
		let comments: Comment[] = [];
		let poem: Poem | null = null;
		let category: Category | null = null
		let loggedIn = req.session.get('isLoggedIn');
		let modifyPoem: boolean;
		let showLikeButton: boolean;
		let isAdmin = req.session.get("isAdmin");
		let like: Like | null = null;

		if(isNaN(id)){
			await res.send({
				statusCode: StatusCode.BadRequest,
				message: "Invalid ID",
				template: "ErrorFormView"
			});
			return;
		}

		try {
			poem = await Poem.read(this.sql, id);
		} catch (error) {
			const message = `Error while getting poem list: ${error}`;
			await res.send({
				statusCode : StatusCode.InternalServerError,
				message: message,
				template: "ErrorFormView"
			});
			return;
		}
		try {
			comments = await Comment.readAll(this.sql, id);
		} catch (error) {
			const message = `Error while getting comment list: ${error}`;
			await res.send({
				statusCode : StatusCode.InternalServerError,
				message: message,
				template: "ErrorFormView"
			});
			return
		}
		const commentList = comments.map((comment) => {
			if(comment.props.userId === userId || isAdmin === true){
				comment.props.canModify = true
			}
			else{
				comment.props.canModify = false
			}
			return {
				...comment.props
			};
		});

		if(poem){
			try{
				category = await Category.read(this.sql, poem.props.categoryId || 1)
			}
			catch (error) {
				const message = `Error while getting category: ${error}`;
				await res.send({
					statusCode : StatusCode.InternalServerError,
					message: message,
					template: "ErrorFormView"
				});
				return
			}
			if(userId === poem.props.userId || isAdmin){
				modifyPoem = true
			}
			else{
				modifyPoem = false
			}
			try{
				like = await Like.read(this.sql, userId, poem.props.id || 1);
			}
			catch (error) {
				const message = `Error while getting like: ${error}`;
				await res.send({
					statusCode : StatusCode.InternalServerError,
					message: message,
					template: "ErrorFormView"
				});
				return
			}
			if(like){
				showLikeButton = false
			}
			else{
				showLikeButton = true
			}
			await res.send({
				statusCode: StatusCode.OK,
				message: "Poem retrieved",
				template: "ShowView",
				payload: {
					poem: poem?.props,
					title: poem?.props.title,
					isLoggedIn: loggedIn,
					comments: commentList,
					category: category?.props,
					userId: userId,
					modifyPoem: modifyPoem,
					showLike: showLikeButton
				},
			});
		}
		else{
			await res.send({
				statusCode: StatusCode.NotFound,
				message: "Not found",
				template: "ErrorFormView"
			});
		}
	};
	createLike = async (req: Request, res: Response) => {
		let like: Like | null = null;
		let poemId = req.getId();
		
		let likeProps: LikeProps = {
			userId: req.session.get("userId"),
			poemId: req.getId()
		};
		try {
			like = await Like.create(this.sql, likeProps);
		} catch (error) {
			await res.send({
				statusCode: StatusCode.InternalServerError,
				message: "Error liking",
				template: "ErrorFormView",
				payload: { message: "Error liking poem"}
			});
			return
		}
		let loggedIn = req.session.get('isLoggedIn');

		await res.send({
			statusCode: StatusCode.Created,
			message: "Like created successfully!",
			payload: {isLoggedIn: loggedIn },
			redirect: `/poems/${poemId}`,
		});
		
	};
	createComment = async (req: Request, res: Response) => {
		let comment: Comment | null = null;
		
		
		let commentProps: CommentProps = {
			title: req.body.title,
			description: req.body.description,
			createdAt: createUTCDate(),
			userId: req.session.get("userId"),
			poemId: req.getId()
		};
		let loggedIn = req.session.get('isLoggedIn');
		if(!loggedIn){
			await res.send({
				statusCode: StatusCode.Unauthorized,
				message: "Unauthorized",
				redirect: "/login"
			});
			return;
		}
		try {
			comment = await Comment.create(this.sql, commentProps);
		} catch (error) {
			await res.send({
				statusCode: StatusCode.BadRequest,
				message: "Request body must include title and description.",
				template: "ErrorFormView",
				payload: {}
			});
			return
		}
		await res.send({
			statusCode: StatusCode.Created,
			message: "Comment created successfully!",
			payload: { comments: comment?.props, isLoggedIn: loggedIn },
			redirect: `/poems/${comment.props.poemId}`,
		});
		
	};
	getEditCommentForm = async (req: Request, res: Response) => {
		const id = req.getCommentId();
		let comment: Comment | null = null;
		let userId = req.session.get("userId");
		let isAdmin = req.session.get('isAdmin');

		let loggedIn = req.session.get('isLoggedIn');
		if(!loggedIn){
			await res.send({
				statusCode: StatusCode.Unauthorized,
				message: "Unauthorized",
				redirect: "/login"
			});
			return;
		}
		try {
			comment = await Comment.read(this.sql, id);
		} catch (error) {
			const message = `Error while getting comment: ${error}`;
			await res.send({
				statusCode : StatusCode.InternalServerError,
				message: message,
				template: "ErrorFormView"
			});
			return;
		}
		if(userId === comment?.props.userId || isAdmin === true){
			await res.send({
				statusCode: StatusCode.OK,
				message: "Edit Comment form",
				template: "EditCommentForm",
				payload: { comment: comment?.props, title: "Edit Comment", isLoggedIn: loggedIn, userId: userId },
			});
		}
		else{
			await res.send({
				statusCode: StatusCode.Unauthorized,
				message: "Unauthorized",
				redirect: "/login"
			});
			return;
		}
	};

	updateComment = async (req: Request, res: Response) => {
		const id = req.getCommentId2();
		const commentProps: Partial<CommentProps> = {};
		let userId = req.session.get("userId");
		let isAdmin = req.session.get("isAdmin");

		if (req.body.title) {
			commentProps.title = req.body.title;
		}

		if (req.body.description) {
			commentProps.description = req.body.description;
		}

		let comment: Comment | null = null;

		try {
			comment = await Comment.read(this.sql, id);
		} catch (error) {
			await res.send({
				statusCode : StatusCode.InternalServerError,
				message: "Error updating comment",
				template: "ErrorFormView"
			});
			return;
		}
		if(userId === comment?.props.userId || isAdmin === true){
			try {
				await comment?.update(commentProps);
			} catch (error) {
				await res.send({
					statusCode : StatusCode.InternalServerError,
					message: "error updating comment",
					template: "ErrorFormView"
				});
				return;
			}
			await res.send({
				statusCode: StatusCode.OK,
				message: "Comment updated successfully!",
				payload: { comment: comment?.props },
				redirect: `/poems/${comment?.props.poemId}`,
			});
		}
		else{
			await res.send({
				statusCode : StatusCode.Unauthorized,
				message: "Must be owner or admin",
				template: "ErrorFormView"
			});
		}
	};

	deleteComment = async (req: Request, res: Response) => {
		const id = req.getCommentId();
		let comment: Comment | null = null;
		let userId = req.session.get("userId");
		let isAdmin = req.session.get("isAdmin");

		try {
			comment = await Comment.read(this.sql, id);
		} catch (error) {
			await res.send({
				statusCode : StatusCode.OK,
				message: "error deleting comment",
				template: "ErrorFormView"
			});
			return;
		}
		if(userId === comment?.props.userId || isAdmin === true){
			try {
				await comment?.delete();
			} catch (error) {
				await res.send({
					statusCode : StatusCode.InternalServerError,
					message: "error deleting comment",
					template: "ErrorFormView"
				});
				return;
			}
	
			await res.send({
				statusCode: StatusCode.OK,
				message: "Comment deleted successfully!",
				payload: { comment: comment?.props },
				redirect: `/poems/${comment?.props.poemId}`,
			});
		}
		else{
			await res.send({
				statusCode : StatusCode.Unauthorized,
				message: "Must be owner or admin",
				template: "ErrorFormView"
			});
		}
	};
	createPoem = async (req: Request, res: Response) => {
		let poem: Poem | null = null;
		let categoryName = req.body.category;
        let category = await Category.getCategory(this.sql, categoryName);

		let poemProps: PoemProps = {
			title: req.body.title,
			description: req.body.description,
			createdAt: createUTCDate(),
			categoryId: category?.props.id,
			userId: req.session.get('userId')
		};
		let loggedIn = req.session.get('isLoggedIn');
		if(!loggedIn){
			await res.send({
				statusCode: StatusCode.Unauthorized,
				message: "Unauthorized",
				redirect: "/login"
			});
			return;
		}
		try {
			poem = await Poem.create(this.sql, poemProps);
		} catch (error) {
			await res.send({
				statusCode: StatusCode.BadRequest,
				message: "Request body must include title and description.",
				template: "ErrorFormView",
				payload: {}
			});
			return
		}
		await res.send({
			statusCode: StatusCode.Created,
			message: "Poem created successfully!",
			payload: { poem: poem?.props, isLoggedIn: loggedIn },
			redirect: `/poems/${poem?.props.id}`,
		});
		
	};

	updatePoem = async (req: Request, res: Response) => {
		const id = req.getId();
		const poemProps: Partial<PoemProps> = {};
		let userId = req.session.get("userId");
		let isAdmin = req.session.get("isAdmin");

		if (req.body.title) {
			poemProps.title = req.body.title;
		}

		if (req.body.description) {
			poemProps.description = req.body.description;
		}

		let poem: Poem | null = null;

		try {
			poem = await Poem.read(this.sql, id);
		} catch (error) {
			await res.send({
				statusCode : StatusCode.InternalServerError,
				message: "error updating poem",
				template: "ErrorFormView"
			});
			return;
		}

		if(userId === poem?.props.userId || isAdmin === true){	
			try {
				await poem?.update(poemProps);
			} catch (error) {
				await res.send({
					statusCode : StatusCode.InternalServerError,
					message: "error updating poem",
					template: "ErrorFormView"
				});
				return;
			}
			await res.send({
				statusCode: StatusCode.OK,
				message: "Poem updated successfully!",
				payload: { poem: poem?.props },
				redirect: `/poems/${id}`,
			});
		}
		else{
			await res.send({
				statusCode : StatusCode.Unauthorized,
				message: "Must be owner or admin",
				template: "ErrorFormView"
			});
		}
	};


	deletePoem = async (req: Request, res: Response) => {
		const id = req.getId();
		let poem: Poem | null = null;
		let userId = req.session.get("userId");
		let isAdmin = req.session.get("isAdmin");
	

		try {
			poem = await Poem.read(this.sql, id);
		} catch (error) {
			await res.send({
				statusCode : StatusCode.InternalServerError,
				message: "error deleting poem",
				template: "ErrorFormView"
			});
			return;
		}
		if(userId === poem?.props.userId || isAdmin === true){
			try {
				await poem?.delete();
			} catch (error) {
				await res.send({
					statusCode : StatusCode.InternalServerError,
					message: "error deleting poem",
					template: "ErrorFormView"
				});
				return;
			}
	
			await res.send({
				statusCode: StatusCode.OK,
				message: "Poem deleted successfully!",
				payload: { poem: poem?.props },
				redirect: "/poems",
			});
		}
		else{
			await res.send({
				statusCode : StatusCode.Unauthorized,
				message: "Must be owner or admin",
				template: "ErrorFormView"
			});
		}
	};
}

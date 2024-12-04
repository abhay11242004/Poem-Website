import postgres from "postgres";
import {
	camelToSnake,
	convertToCase,
	createUTCDate,
	snakeToCamel,
} from "../utils";

export interface CommentProps {
	id?: number;
	title: string;
	description: string;
	createdAt: Date;
	editedAt?: Date;
	userId: number;
	poemId: number;
	canModify?: boolean;
}

export default class Comment {
	constructor(
		private sql: postgres.Sql<any>,
		public props: CommentProps,
	) {}

	static async create(sql: postgres.Sql<any>, props: CommentProps) {
		const connection = await sql.reserve();

		props.createdAt = props.createdAt ?? createUTCDate();

		console.log(props)
		const [row] = await connection<CommentProps[]>`
			INSERT INTO comments
				${sql(convertToCase(camelToSnake, props))}
			RETURNING *
		`;
		if (!row) {
			console.log("pourquoi ca ne marche pas ca fait chuier")
		}
		console.log(row.description)
		await connection.release();

		return new Comment(sql, convertToCase(snakeToCamel, row) as CommentProps);
	}

	static async read(sql: postgres.Sql<any>, id: number) {
		const connection = await sql.reserve();

		const [row] = await connection<CommentProps[]>`
			SELECT * FROM
			comments WHERE id = ${id}
		`;

		await connection.release();

		if (!row) {
			return null;
		}

		return new Comment(sql, convertToCase(snakeToCamel, row) as CommentProps);
	}

	static async readAll(
		sql: postgres.Sql<any>,
		poemId: number,
	): Promise<Comment[]> {
		const connection = await sql.reserve();

		const rows = await connection<CommentProps[]>`
			SELECT *
			FROM comments
			WHERE poem_id = ${poemId}
		`;

		await connection.release();

		return rows.map(
			(row) =>
				new Comment(sql, convertToCase(snakeToCamel, row) as CommentProps),
		);
	}

	async update(updateProps: Partial<CommentProps>) {
		const connection = await this.sql.reserve();

		const [row] = await connection`
			UPDATE comments
			SET
				${this.sql(convertToCase(camelToSnake, updateProps))}, edited_at = ${createUTCDate()}
			WHERE
				id = ${this.props.id}
			RETURNING *
		`;

		await connection.release();

		this.props = { ...this.props, ...convertToCase(snakeToCamel, row) };
	}

	async delete() {
		const connection = await this.sql.reserve();

		const result = await connection`
			DELETE FROM comments
			WHERE id = ${this.props.id}
		`;

		await connection.release();

		return result.count === 1;
	}

}

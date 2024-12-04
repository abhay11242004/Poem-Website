import postgres from "postgres";
import {
	camelToSnake,
	convertToCase,
	createUTCDate,
	snakeToCamel,
} from "../utils";

export interface LikeProps {
	id?: number;
    userId: number;
    poemId: number;
}

export default class Like {
	constructor(
		private sql: postgres.Sql<any>,
		public props: LikeProps,
	) {}

	static async create(sql: postgres.Sql<any>, props: LikeProps) {
		const connection = await sql.reserve();

		const [row] = await connection<LikeProps[]>`
			INSERT INTO likes
				${sql(convertToCase(camelToSnake, props))}
			RETURNING *
		`;
		await connection.release();

		return new Like(sql, convertToCase(snakeToCamel, row) as LikeProps);
	}

	static async read(sql: postgres.Sql<any>, userId: number, poemId: number) {
		const connection = await sql.reserve();

		const [row] = await connection<LikeProps[]>`
			SELECT * FROM
			likes WHERE user_id = ${userId} AND poem_id = ${poemId}
		`;

		await connection.release();

		if (!row) {
			return null;
		}

		return new Like(sql, convertToCase(snakeToCamel, row) as LikeProps);
	}
	static async readAllOfUser(
		sql: postgres.Sql<any>,
		userId: number,
	): Promise<Like[]> {
		const connection = await sql.reserve();

		const rows = await connection<LikeProps[]>`
			SELECT *
			FROM likes
			WHERE user_id = ${userId}
		`;

		await connection.release();

		return rows.map(
			(row) =>
				new Like(sql, convertToCase(snakeToCamel, row) as LikeProps),
		);
	}
}

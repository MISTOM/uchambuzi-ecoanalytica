import { error } from '@sveltejs/kit';
import { REFRESH_KEY, SECRET_KEY, RESET_KEY } from '$env/static/private';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '$lib/server/prisma';

let roleCache: any;
type AuthPayload = {
	id: number;
	roleId: number;
};

export function sign(payload: AuthPayload): string {
	//maxAge
	const maxAge = '30m'; // 30 minutes
	const id = payload.id;
	const role = payload.roleId;

	return jwt.sign({ id, role }, SECRET_KEY, {
		expiresIn: maxAge
	});
}

/**
 * Generate refresh token and save it to the database
 */
export async function generateRefreshToken(user: any): Promise<string> {
	const maxAge = '7d'; // 7 days
	const id = user.id;

	try {
		const refreshToken = jwt.sign({ id }, REFRESH_KEY, {
			expiresIn: maxAge
		});
		//save the refresh token to the database
		await prisma.user.update({
			where: { id },
			data: {
				refreshToken: refreshToken
			}
		});

		return refreshToken;
	} catch (e) {
		console.log('Error generating refresh token', e);
		throw error(500, 'Error generating refresh token');
	}
}

/**
 * Generate reset Password token
 */
export function generateResetToken(id: number) {
	const maxAge = 60 * 60; // 1 hour
	return jwt.sign({ id }, RESET_KEY, { expiresIn: maxAge });
}

/**
 * Compare Passwords to it's hash
 * @param password
 * @param hash
 */
export async function compare(password: string | Buffer, hash: string) {
	const validPassword = await bcrypt.compare(password, hash);
	if (!validPassword) throw error(400, 'Invalid password');
}

/**
 * Hash Password
 * @param password The password to encrypt
 * @returns Encrypted Password
 */
export async function hash(password: string | Buffer) {
	const salt = await bcrypt.genSalt();
	return await bcrypt.hash(password, salt);
}

/**
 * Get roles from the database
 */
export async function getRoles(roleName: string | null = null): Promise<any> {
	if (!roleCache) {
		console.log('Querying db for roles');
		await prisma.role
			.findMany()
			//@ts-ignore
			.then((roles) => {
				roleCache = roles;
			}) //@ts-ignore
			.catch((err) => {
				console.log('Error getting roles', err);
				throw error(500, 'Error getting roles');
			});
	}

	if (roleName) {
		//@ts-ignore
		const role = roleCache.find((role) => role.name === roleName);
		if (!role) {
			throw error(404, `Role ${roleName} not found`);
		}
		return [role];
	}
	return roleCache;
}
/**
 * Check if user is an admin
 */
export async function isAdmin(user: any) {
	if (!user) return error(401, 'Unauthorized');
	const roles = await getRoles();
	//@ts-ignore
	const adminRole = roles.find((role) => role.name === 'ADMIN');
	if (!adminRole || user.role !== adminRole.id) {
		throw error(401, 'Unauthorized, you must be an admin');
	}
	return true;
}

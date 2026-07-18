/**
 * @openapi
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         phoneNumber:
 *           type: string
 *           nullable: true
 *         address:
 *           type: string
 *           nullable: true
 *         status:
 *           type: string
 *           enum: ["active","inactive","suspended","pending"]
 *         isEmailVerified:
 *           type: boolean
 *         lastLoginAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       required: [id,firstName,lastName,email,status,isEmailVerified,createdAt,updatedAt]
 *     CreateUser:
 *       type: object
 *       properties:
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *         phoneNumber:
 *           type: string
 *         address:
 *           type: string
 *       required: [firstName,lastName,email,password]
 *     LoginRequest:
 *       type: object
 *       properties:
 *         email:
 *           type: string
 *         password:
 *           type: string
 *       required: [email,password]
 *     AuthResponse:
 *       type: object
 *       properties:
 *         accessToken:
 *           type: string
 *         refreshToken:
 *           type: string
 *         user:
 *           $ref: '#/components/schemas/User'
 *     UserListResponse:
 *       type: object
 *       properties:
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/User'
 *         total:
 *           type: integer
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         statusCode:
 *           type: integer
 *           example: 400
 *         message:
 *           type: string
 *           example: "Validation failed"
 *   parameters:
 *     UserIdParam:
 *       name: id
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *         format: uuid
 * /users:
 *   post:
 *     tags:
 *       - Users
 *     summary: Register user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUser'
 *           example:
 *             firstName: "John"
 *             lastName: "Doe"
 *             email: "john@example.com"
 *             password: "secret123"
 *     responses:
 *       '201':
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       '400':
 *         description: Validation errors
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   get:
 *     tags:
 *       - Users
 *     summary: List users (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserListResponse'
 * /users/login:
 *   post:
 *     tags:
 *       - Users
 *     summary: User login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       '200':
 *         description: Authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       '401':
 *         description: Invalid credentials
 * /users/forgot-password:
 *   post:
 *     tags:
 *       - Users
 *     summary: Request password reset
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       '200':
 *         description: If the email exists, a reset token will be sent
 * /users/reset-password:
 *   post:
 *     tags:
 *       - Users
 *     summary: Reset password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Password reset
 * /users/verify-email:
 *   post:
 *     tags:
 *       - Users
 *     summary: Verify user email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Email verified
 * /users/resend-verification-email:
 *   post:
 *     tags:
 *       - Users
 *     summary: Resend verification email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Verification email resent if account exists
 * /users/me:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get current user's profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *   patch:
 *     tags:
 *       - Users
 *     summary: Update current user's profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Updated
 * /users/change-password:
 *   patch:
 *     tags:
 *       - Users
 *     summary: Change password (authenticated)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Password changed
 * /users/profile-image:
 *   patch:
 *     tags:
 *       - Users
 *     summary: Update profile image (authenticated)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Profile image updated
 * /users/admin:
 *   get:
 *     tags:
 *       - Users
 *     summary: Admin - list users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: OK
 * /users/admin/{id}:
 *   get:
 *     tags:
 *       - Users
 *     summary: Admin - get user by id
 *     parameters:
 *       - $ref: '#/components/parameters/UserIdParam'
 *     responses:
 *       '200':
 *         description: OK
 *   patch:
 *     tags:
 *       - Users
 *     summary: Admin - update user status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/UserIdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: ["active","inactive","suspended","pending"]
 *     responses:
 *       '200':
 *         description: Status updated
 *   delete:
 *     tags:
 *       - Users
 *     summary: Admin - delete user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/UserIdParam'
 *     responses:
 *       '204':
 *         description: Deleted
 */
import { Router } from 'express';

import {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerificationEmail,
  getMe,
  updateMe,
  changePassword,
  updateProfileImage,
  deleteMe,
  listUsers,
  getUserById,
  updateUserStatus,
} from '../controllers/user.controller';
import {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateVerifyEmail,
  validateUpdateProfile,
  validateChangePassword,
  authenticateUser,
} from '../middlewares/user.middleware';
import { type UpdateUserParams } from '../types/user.types';

const userRouter = Router();

// Public
userRouter.post('/register', validateRegister, registerUser);
userRouter.post('/login', validateLogin, loginUser);
userRouter.post('/forgot-password', validateForgotPassword, forgotPassword);
userRouter.post('/reset-password', validateResetPassword, resetPassword);
userRouter.post('/verify-email', validateVerifyEmail, verifyEmail);
userRouter.post('/resend-verification-email', validateForgotPassword, resendVerificationEmail);

// Authenticated
userRouter.get('/me', authenticateUser, getMe);
userRouter.patch('/me', authenticateUser, validateUpdateProfile, updateMe);
userRouter.patch('/change-password', authenticateUser, validateChangePassword, changePassword);
userRouter.patch('/profile-image', authenticateUser, updateProfileImage);
userRouter.delete('/me', authenticateUser, deleteMe);

// Admin routes (mount under /admin in admin router)
userRouter.get('/admin', listUsers);
userRouter.get('/admin/:id', getUserById);
userRouter.patch<UpdateUserParams, unknown, { status: string }>(
  '/admin/:id/status',
  updateUserStatus,
);
userRouter.delete('/admin/:id', getUserById);

export { userRouter };

/**
 * @openapi
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     Admin:
 *       type: object
 *       description: Representation of an administrator user in the system.
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: "3fa85f64-5717-4562-b3fc-2c963f66afa6"
 *         firstName:
 *           type: string
 *           example: "Alice"
 *         lastName:
 *           type: string
 *           example: "Johnson"
 *         email:
 *           type: string
 *           format: email
 *           example: "alice@example.com"
 *         phoneNumber:
 *           type: string
 *           nullable: true
 *           example: "+1-555-555-5555"
 *         role:
 *           type: string
 *           description: Role assigned to the admin. One of the allowed admin roles.
 *           enum: ["superAdmin", "admin", "manager", "support"]
 *           example: "admin"
 *         permissions:
 *           type: object
 *           nullable: true
 *           description: Custom JSON object listing granular permissions or feature flags.
 *         profileImageUrl:
 *           type: string
 *           nullable: true
 *           format: uri
 *         status:
 *           type: string
 *           enum: ["active", "inactive", "suspended", "pending"]
 *           example: "active"
 *         isEmailVerified:
 *           type: boolean
 *           example: false
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       required: [id, firstName, lastName, email, role, status, createdAt, updatedAt]
 *     CreateAdmin:
 *       type: object
 *       description: Payload to create a new admin. Only superadmin may call this endpoint.
 *       properties:
 *         firstName:
 *           type: string
 *           example: "Alice"
 *         lastName:
 *           type: string
 *           example: "Johnson"
 *         email:
 *           type: string
 *           format: email
 *           example: "alice@example.com"
 *         phoneNumber:
 *           type: string
 *           nullable: true
 *         password:
 *           type: string
 *           format: password
 *           example: "StrongP@ssw0rd"
 *         role:
 *           type: string
 *           enum: ["superAdmin", "admin", "manager", "support"]
 *           example: "admin"
 *         permissions:
 *           type: object
 *           nullable: true
 *           description: JSON object with specific permissions. Optional.
 *         profileImageUrl:
 *           type: string
 *           nullable: true
 *           format: uri
 *         status:
 *           type: string
 *           enum: ["active", "inactive", "suspended", "pending"]
 *           example: "pending"
 *       required: [firstName, lastName, email, password, role]
 *     UpdateAdmin:
 *       type: object
 *       description: Fields that may be updated on an admin. All fields optional; immutable fields (id) are excluded.
 *       properties:
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
 *         password:
 *           type: string
 *           format: password
 *         role:
 *           type: string
 *           enum: ["superAdmin", "admin", "manager", "support"]
 *         permissions:
 *           type: object
 *           nullable: true
 *         profileImageUrl:
 *           type: string
 *           format: uri
 *         isEmailVerified:
 *           type: boolean
 *     AdminLogin:
 *       type: object
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: "alice@example.com"
 *         password:
 *           type: string
 *           format: password
 *           example: "StrongP@ssw0rd"
 *       required: [email, password]
 *     AuthResponse:
 *       type: object
 *       properties:
 *         accessToken:
 *           type: string
 *           example: "eyJhbGciOiJI..."
 *         refreshToken:
 *           type: string
 *           example: "eyJhbGciOiJI..."
 *         tokenType:
 *           type: string
 *           example: "Bearer"
 *         expiresIn:
 *           type: integer
 *           example: 3600
 *     AdminStatusUpdate:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: ["active", "inactive", "suspended", "pending"]
 *           example: "active"
 *       required: [status]
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         statusCode:
 *           type: integer
 *           example: 400
 *         message:
 *           type: string
 *           example: "Validation failed"
 *         errors:
 *           type: array
 *           items:
 *             type: object
 *       required: [statusCode, message]
 *     AdminListResponse:
 *       type: object
 *       properties:
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Admin'
 *         meta:
 *           type: object
 *           properties:
 *             page:
 *               type: integer
 *               example: 1
 *             limit:
 *               type: integer
 *               example: 20
 *             total:
 *               type: integer
 *               example: 125
 *   parameters:
 *     AdminIdParam:
 *       name: id
 *       in: path
 *       description: UUID of the admin
 *       required: true
 *       schema:
 *         type: string
 *         format: uuid
 *     PaginationPage:
 *       name: page
 *       in: query
 *       schema:
 *         type: integer
 *         default: 1
 *       description: Page number for paginated results
 *     PaginationLimit:
 *       name: limit
 *       in: query
 *       schema:
 *         type: integer
 *         default: 20
 *       description: Number of items per page
 *     SearchQuery:
 *       name: q
 *       in: query
 *       schema:
 *         type: string
 *       description: Search term to match against name or email
 *     RoleFilter:
 *       name: role
 *       in: query
 *       schema:
 *         type: string
 *         enum: ["superAdmin", "admin", "manager", "support"]
 *       description: Filter results by admin role
 *     StatusFilter:
 *       name: status
 *       in: query
 *       schema:
 *         type: string
 *         enum: ["active", "inactive", "suspended", "pending"]
 *       description: Filter results by admin status
 *
 * /admins:
 *   get:
 *     tags:
 *       - Admins
 *     summary: List admins (superadmin)
 *     description: |
 *       Returns a paginated list of administrators. This endpoint is protected and
 *       should be accessible only by users with the `superAdmin` role. Use query
 *       parameters to paginate, search and filter results.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PaginationPage'
 *       - $ref: '#/components/parameters/PaginationLimit'
 *       - $ref: '#/components/parameters/SearchQuery'
 *       - $ref: '#/components/parameters/RoleFilter'
 *       - $ref: '#/components/parameters/StatusFilter'
 *       - name: sortBy
 *         in: query
 *         schema:
 *           type: string
 *         description: Field name to sort by (e.g., createdAt, email)
 *       - name: order
 *         in: query
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       '200':
 *         description: A paginated list of admins
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminListResponse'
 *             examples:
 *               success:
 *                 value:
 *                   data:
 *                     - id: "3fa85f64-5717-4562-b3fc-2c963f66afa6"
 *                       firstName: "Alice"
 *                       lastName: "Johnson"
 *                       email: "alice@example.com"
 *                       phoneNumber: "+1-555-555-5555"
 *                       role: "admin"
 *                       permissions: {}
 *                       profileImageUrl: null
 *                       status: "active"
 *                       isEmailVerified: false
 *                       createdAt: "2024-01-01T12:00:00Z"
 *                       updatedAt: "2024-01-02T12:00:00Z"
 *                   meta:
 *                     page: 1
 *                     limit: 20
 *                     total: 1
 *       '401':
 *         description: Unauthorized - missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missing_token:
 *                 value:
 *                   statusCode: 401
 *                   message: "Authentication token is missing or invalid"
 *       '403':
 *         description: Forbidden - insufficient privileges (not superadmin)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               forbidden:
 *                 value:
 *                   statusCode: 403
 *                   message: "Access denied: superadmin role required"
 *
 *   post:
 *     tags:
 *       - Admins
 *     summary: Create admin (superadmin)
 *     description: |
 *       Create a new administrator account. This action is restricted to the
 *       `superAdmin` role. Passwords should meet the project's password policy.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: Admin information to create
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateAdmin'
 *           examples:
 *             create:
 *               value:
 *                 firstName: "Alice"
 *                 lastName: "Johnson"
 *                 email: "alice@example.com"
 *                 password: "StrongP@ssw0rd"
 *                 role: "admin"
 *     responses:
 *       '201':
 *         description: Admin created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Admin'
 *             examples:
 *               created:
 *                 value:
 *                   id: "3fa85f64-5717-4562-b3fc-2c963f66afa6"
 *                   firstName: "Alice"
 *                   lastName: "Johnson"
 *                   email: "alice@example.com"
 *                   role: "admin"
 *                   status: "pending"
 *                   isEmailVerified: false
 *                   createdAt: "2024-01-01T12:00:00Z"
 *                   updatedAt: "2024-01-01T12:00:00Z"
 *       '400':
 *         description: Bad request - validation errors
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         description: Forbidden - user not allowed to create admins
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /admins/login:
 *   post:
 *     tags:
 *       - Admins
 *     summary: Admin login
 *     description: |
 *       Authenticate an admin user using email and password. Returns an access
 *       token (JWT) and a refresh token. Use `Authorization: Bearer <accessToken>`
 *       for protected endpoints.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminLogin'
 *           examples:
 *             credentials:
 *               value:
 *                 email: "alice@example.com"
 *                 password: "StrongP@ssw0rd"
 *     responses:
 *       '200':
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *             examples:
 *               ok:
 *                 value:
 *                   accessToken: "eyJhbGciOiJI..."
 *                   refreshToken: "eyJhbGciOiJI..."
 *                   tokenType: "Bearer"
 *                   expiresIn: 3600
 *       '400':
 *         description: Bad request - validation errors
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized - invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /admins/{id}:
 *   get:
 *     tags:
 *       - Admins
 *     summary: Get admin by ID
 *     description: Retrieve an administrator's details by their UUID. Accessible
 *       to authenticated admins; superadmin access may be required depending on
 *       business rules.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AdminIdParam'
 *     responses:
 *       '200':
 *         description: Admin details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Admin'
 *             examples:
 *               success:
 *                 value:
 *                   id: "3fa85f64-5717-4562-b3fc-2c963f66afa6"
 *                   firstName: "Alice"
 *                   lastName: "Johnson"
 *                   email: "alice@example.com"
 *                   role: "admin"
 *                   status: "active"
 *                   isEmailVerified: true
 *                   createdAt: "2024-01-01T12:00:00Z"
 *                   updatedAt: "2024-01-02T12:00:00Z"
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: Not found - no admin with given id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *   put:
 *     tags:
 *       - Admins
 *     summary: Update admin
 *     description: |
 *       Update an administrator's profile. Immutable fields such as `id` and
 *       `createdAt` cannot be changed. Password updates are supported via the
 *       `password` field. Caller must be authenticated; role-based checks apply.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AdminIdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateAdmin'
 *           examples:
 *             update:
 *               value:
 *                 firstName: "Alicia"
 *                 phoneNumber: "+1-555-000-0000"
 *     responses:
 *       '200':
 *         description: Admin updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Admin'
 *       '400':
 *         description: Validation errors
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden - insufficient privileges
 *
 * /admins/{id}/status:
 *   patch:
 *     tags:
 *       - Admins
 *     summary: Update admin status (superadmin)
 *     description: |
 *       Update the `status` of an admin. This endpoint is restricted to the
 *       `superAdmin` role. Use the `status` enum values documented in the schema.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AdminIdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminStatusUpdate'
 *           examples:
 *             activate:
 *               value:
 *                 status: "active"
 *     responses:
 *       '200':
 *         description: Admin status updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Admin'
 *       '400':
 *         description: Bad request - invalid status value
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden - only superadmin can change status
 */
import { Router } from 'express';

import {
  createAdmin,
  loginAdmin,
  updateAdmin,
  updateAdminStatus,
  getAdmins,
  getAdminById,
} from '../controllers/admin.controller';
import {
  authenticateAdmin,
  authenticateSuperAdmin,
  validateCreateAdmin,
  validateLoginAdmin,
  validateUpdateAdmin,
  validateUpdateAdminStatus,
} from '../middlewares/admin.middleware';
import {
  type UpdateAdminInput,
  type UpdateAdminParams,
  type UpdateAdminStatusInput,
} from '../types/admin.types';

const adminRouter = Router();

adminRouter.post('/create', authenticateSuperAdmin, validateCreateAdmin, createAdmin);
adminRouter.get('/', authenticateSuperAdmin, getAdmins);
adminRouter.post('/login', validateLoginAdmin, loginAdmin);
adminRouter.get('/:id', authenticateSuperAdmin, getAdminById);
adminRouter.put<UpdateAdminParams, unknown, UpdateAdminInput>(
  '/:id',
  authenticateAdmin,
  validateUpdateAdmin,
  updateAdmin,
);

adminRouter.patch<UpdateAdminParams, unknown, UpdateAdminStatusInput>(
  '/:id/status',
  authenticateSuperAdmin,
  validateUpdateAdminStatus,
  updateAdminStatus,
);

export { adminRouter };

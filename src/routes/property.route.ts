/**
 * @openapi
 * components:
 *   schemas:
 *     Property:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         title:
 *           type: string
 *         description:
 *           type: string
 *           nullable: true
 *         type:
 *           type: string
 *           enum: ["apartment", "house", "villa", "office", "shop", "land"]
 *         listingType:
 *           type: string
 *           enum: ["rent", "sale"]
 *         price:
 *           type: number
 *           format: float
 *         currency:
 *           type: string
 *         address:
 *           type: string
 *         city:
 *           type: string
 *         state:
 *           type: string
 *           nullable: true
 *         country:
 *           type: string
 *         postalCode:
 *           type: string
 *           nullable: true
 *         latitude:
 *           type: number
 *           nullable: true
 *         longitude:
 *           type: number
 *           nullable: true
 *         bedrooms:
 *           type: integer
 *           nullable: true
 *         bathrooms:
 *           type: integer
 *           nullable: true
 *         areaSize:
 *           type: number
 *           nullable: true
 *         areaUnit:
 *           type: string
 *           nullable: true
 *         amenities:
 *           type: object
 *           nullable: true
 *         images:
 *           type: array
 *           items:
 *             type: string
 *           nullable: true
 *         status:
 *           type: string
 *           enum: ["draft", "active", "inactive", "sold", "rented"]
 *         ownerId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         createdBy:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         updatedBy:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         deletedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *       required: [id, title, type, listingType, price, currency, address, city, country, status, createdAt, updatedAt]
 *     CreateProperty:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *         description:
 *           type: string
 *           nullable: true
 *         type:
 *           type: string
 *           enum: ["apartment", "house", "villa", "office", "shop", "land"]
 *         listingType:
 *           type: string
 *           enum: ["rent", "sale"]
 *         price:
 *           type: number
 *         currency:
 *           type: string
 *         address:
 *           type: string
 *         city:
 *           type: string
 *         state:
 *           type: string
 *           nullable: true
 *         country:
 *           type: string
 *         postalCode:
 *           type: string
 *           nullable: true
 *         bedrooms:
 *           type: integer
 *           nullable: true
 *         bathrooms:
 *           type: integer
 *           nullable: true
 *         areaSize:
 *           type: number
 *           nullable: true
 *         areaUnit:
 *           type: string
 *           nullable: true
 *         amenities:
 *           type: object
 *           nullable: true
 *         images:
 *           type: array
 *           items:
 *             type: string
 *         status:
 *           type: string
 *           enum: ["draft", "active", "inactive", "sold", "rented"]
 *       required: [title, type, listingType, price, address, city, country]
 *     UpdateProperty:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *         description:
 *           type: string
 *           nullable: true
 *         type:
 *           type: string
 *           enum: ["apartment", "house", "villa", "office", "shop", "land"]
 *         listingType:
 *           type: string
 *           enum: ["rent", "sale"]
 *         price:
 *           type: number
 *         currency:
 *           type: string
 *         address:
 *           type: string
 *         city:
 *           type: string
 *         state:
 *           type: string
 *           nullable: true
 *         country:
 *           type: string
 *         postalCode:
 *           type: string
 *           nullable: true
 *         status:
 *           type: string
 *           enum: ["draft", "active", "inactive", "sold", "rented"]
 *   parameters:
 *     PropertyIdParam:
 *       name: id
 *       in: path
 *       required: true
 *       schema:
 *         type: string
 *         format: uuid
 * /properties:
 *   get:
 *     tags:
 *       - Properties
 *     summary: List properties
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: ["draft", "active", "inactive", "sold", "rented"]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: ["apartment", "house", "villa", "office", "shop", "land"]
 *       - in: query
 *         name: listingType
 *         schema:
 *           type: string
 *           enum: ["rent", "sale"]
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortDir
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       '200':
 *         description: OK
 * /properties/{id}:
 *   get:
 *     tags:
 *       - Properties
 *     summary: Get property by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PropertyIdParam'
 *     responses:
 *       '200':
 *         description: OK
 *       '404':
 *         description: Property not found
 *   put:
 *     tags:
 *       - Properties
 *     summary: Update property
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PropertyIdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProperty'
 *     responses:
 *       '200':
 *         description: Property updated
 * /properties/create:
 *   post:
 *     tags:
 *       - Properties
 *     summary: Create property
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateProperty'
 *     responses:
 *       '201':
 *         description: Property created
 */
import { Router } from 'express';

import {
  createProperty,
  getProperties,
  getPropertyById,
  updateProperty,
} from '../controllers/property.controller';
import {
  authenticatePropertyAdmin,
  validateCreateProperty,
  validateUpdateProperty,
} from '../middlewares/property.middleware';

const propertyRouter = Router();

propertyRouter.get('/', authenticatePropertyAdmin, getProperties);
propertyRouter.get('/:id', authenticatePropertyAdmin, getPropertyById);
propertyRouter.post('/create', authenticatePropertyAdmin, validateCreateProperty, createProperty);
propertyRouter.put('/:id', authenticatePropertyAdmin, validateUpdateProperty, updateProperty);

export { propertyRouter };

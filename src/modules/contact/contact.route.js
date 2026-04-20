'use strict';
const ContactController = require( './contact.controller' );
const AuthController = require( '../auth/auth.controller' );
const express = require( 'express' );
const router = express.Router();

router.use(AuthController.checkLogin);

router.get( '/', ContactController.getAll );
router.get( '/:id', ContactController.get );
router.post( '/', ContactController.insert );
router.post( '/file-process', ContactController.processFile );
router.put( '/:id', ContactController.update );
router.delete( '/:id', ContactController.delete );


module.exports = router;

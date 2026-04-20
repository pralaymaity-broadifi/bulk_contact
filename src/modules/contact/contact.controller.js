'use strict';
const { CalmController } = require( '../../../system/core/CalmController' );
const { ContactService } = require( './contact.service' );
const { Contact } = require( './contact.model' );
const contactDTO = require( './contact.dto' );
const autoBind = require( 'auto-bind' ),
    contactService = new ContactService(
        new Contact().getInstance()
    );

class ContactController extends CalmController {

    constructor( service ) {
        super( service );
        this.dto = { ...this.dto, ...contactDTO };
        autoBind( this );
    }

    async processFile(req, res, next) {
        try {
            const { fileKey } = req.body;

            if (!fileKey) {
                throw new Error("fileKey is required");
            }

            // Call service
            const response = await this.service.processFile(fileKey);

            res.send(response);

        } catch (e) {
            next(e);
        }
    }

}

module.exports = new ContactController( contactService );

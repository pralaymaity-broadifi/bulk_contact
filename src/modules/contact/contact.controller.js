'use strict';
const { CalmController } = require( '../../../system/core/CalmController' );
const { ContactService } = require( './contact.service' );
const { Contact } = require( './contact.model' );
const contactDTO = require( './contact.dto' );
const path = require("path");


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

            const { filePath } = req.body;

            // convert to absolute path (IMPORTANT FIX)
            const absoluteFilePath = path.join(process.cwd(), filePath);

            const result = await this.service.processFile(
            absoluteFilePath
            );

            res.send(result);

        } catch (e) {
            next(e);
        }
    }

    async getAll( req, res, next ) {
        try {
            const response = await this.service.getAll( req.query );

            console.log('RAW RESPONSE:', response);

            // console.log('GET ALL RESPONSE:', response);
            res.sendCalmResponse( response.data.map( x => new this.dto.GetDTO( x ) ), { 'totalCount': response.total } );
        } catch ( e ) {
            next( e );
        }
    }

    async get( req, res, next ) {
        const { id } = req.params;

        try {
            const response = await this.service.get( id );

            res.sendCalmResponse( new this.dto.GetDTO( response.data ) );
        } catch ( e ) {
            next( e );
        }
    }


}

module.exports = new ContactController( contactService );

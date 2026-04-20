'use strict';
const mongoose = require( 'mongoose' );
const { Schema } = require( 'mongoose' );
const uniqueValidator = require( 'mongoose-unique-validator' );

class Contact {

    initSchema() {
        const schema = new Schema( {
            'name': {
                'type': String,
                'required': true,
            },
            'email': {
                'type': String,
                'required': true,
            },
            'phone': {
                'type': String,
                'required': true,
            },
            'company': {
                'type': String,
                'required': true,
            },
            'normalizedEmail': {
                'type': String,
                'required': true,
            },
            'createdBy': {
                'type': Schema.Types.ObjectId,
                'ref': 'user'
            },
            'updatedBy': {
                'type': Schema.Types.ObjectId,
                'ref': 'user'
            }
        }, { 'timestamps': true } );

        schema.plugin( uniqueValidator );
        try {
            mongoose.model( 'contact', schema );
        } catch ( e ) {

        }

    }

    getInstance() {
        this.initSchema();
        return mongoose.model( 'contact' );
    }
}

module.exports = { Contact };

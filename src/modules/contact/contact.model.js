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
                'unique': true,
                'required': true
            },
            'enrichment': {
                'jobTitle': {
                    'type': String
                },
                'location': {
                    'type': String
                }
            },
            'duplicateScore': {
                'type': Number,
                'default': 0
            },

            'duplicateConfidence': {
                'type': String,
                'enum': [ 'LOW', 'MEDIUM', 'HIGH' ],
                'default': 'LOW'
            },

            'duplicateStatus': {
                'type': String,
                'enum': [ 'NONE', 'POSSIBLE', 'SKIPPED' ],
                'default': 'NONE'
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

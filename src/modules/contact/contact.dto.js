'use strict';

class GetDTO {
    constructor( { ...props } ) {
        this._id = props._id;
        this.name = props.name;
        this.email = props.email;
        this.phone = props.phone;
        this.company = props.company;
        this.normalizedEmail = props.normalizedEmail;

        // Auto Generated Fields
        this.createdBy = props.createdBy;
        this.updatedBy = props.updatedBy;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
        Object.freeze( this );
    }
}


class InsertDTO {
    constructor( { ...props } ) {
        this.name = props.name;
        this.email = props.email;
        this.phone = props.phone;
        this.company = props.company;
        this.normalizedEmail = props.normalizedEmail;
        // Auto Generated Fields
        this.createdBy = props.createdBy;
        Object.freeze( this );
    }
}

class UpdateDTO {
    constructor( { ...props } ) {
        this.name = props.name;
        this.email = props.email;
        this.phone = props.phone;
        this.company = props.company;
        this.normalizedEmail = props.normalizedEmail;
        // Auto Generated Fields
        this.updatedBy = props.updatedBy;
        // Delete Fields which are not present in data
        Object.keys( this ).forEach( key => {
            if ( this[ key ] === undefined ) {
                delete this[ key ];
            }
        } );
        Object.freeze( this );
    }
}

module.exports = { GetDTO, InsertDTO, UpdateDTO };

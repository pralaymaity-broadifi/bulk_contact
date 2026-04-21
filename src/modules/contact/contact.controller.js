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

        // 🔥 convert to absolute path (IMPORTANT FIX)
        const absoluteFilePath = path.join(process.cwd(), filePath);

        const result = await this.service.processFile(
        absoluteFilePath,
        req.user?.id
        );

        res.send(result);

    } catch (e) {
        next(e);
    }
    }

//      async getJobStatus(req, res, next) {
//         try {
//         const { jobId } = req.params;

//         const job = jobTrackingStore.get(jobId);

//         if (!job) {
//             return res.sendCalmResponse({ message: "Job not found" });
//         }

//         res.sendCalmResponse({
//             jobId,
//             ...job
//         });

//         } catch (e) {
//         next(e);
//         }
//   }

}

module.exports = new ContactController( contactService );

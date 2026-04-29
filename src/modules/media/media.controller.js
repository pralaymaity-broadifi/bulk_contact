'use strict';
const { CalmController } = require( '../../../system/core/CalmController' );
const { MediaService } = require( './media.service' );
const { Media } = require( './media.model' );
const autoBind = require( 'auto-bind' );

const fs = require("fs");
const path = require("path");
const multer = require( 'multer' );

const { S3Upload } = require('../../plugins');
const { CalmError } = require('../../../system/core/CalmError');
const ExcelJS = require("exceljs");
const mediaService = new MediaService(
    new Media().getInstance()
);

 const { contactQueue } = require('../../utils/queue/contactQueue');

class MediaController extends CalmController {
    // // file upload using multer
    // storage = multer.memoryStorage( {
    //     'destination': function( req, file, callback ) {
    //         callback( null, '' );
    //     }
    // } );

    // upload = multer( {
    //     'storage': this.storage,
    //     'limits': {
    //         'fileSize': 1024 * 1024 * 25
    //     }
    // } );


    storage = multer.diskStorage({

        // destination (where file will be saved)
        destination: (req, file, cb) => {

            const { fileName, uploadId } = req.body;

            if (!fileName) {
                return cb(new Error("fileName missing"), null);
            }

            if (!uploadId) {
                return cb(new Error("uploadId missing"), null);
            }

            // process.cwd() -> project root folder
            // root/uploads/chunks/{uploadId}
            const dir = path.join(
                process.cwd(),
                "uploads/chunks",
                uploadId
            );

            // This creates the folder.
            fs.mkdirSync(dir, { recursive: true });

            // This tells multer: "Hey, store the incoming file in this folder"
            cb(null, dir);
        },

        // filename (how file will be named)
        filename: (req, file, cb) => {

            const { chunkIndex } = req.body;

            if (chunkIndex === undefined) {
                return cb(new Error("chunkIndex missing"), null);
            }

            // File will be saved as: uploads/chunks/{uploadId}/{chunkIndex}
            cb(null, String(chunkIndex));
        }
    });

    upload = multer({
        storage: this.storage,
        limits: {
            fileSize: 50 * 1024 * 1024 // 50MB per chunk
        }
    });




    constructor( service ) {
        super( service );
        this.S3Upload = new S3Upload();
        autoBind( this );
    }

    async insert( req, res, next ) {
        try {
            if(!req.file) {
                throw new CalmError('VALIDATION_ERROR', 'File is required');
            }
            const { key } = await this.S3Upload.uploadFile( req.file.buffer, req.file.originalname, { ACL: 'public-read', pathPrefix: 'uploads' } );
            const response = await this.service.insert( { ...req.file, 'path': key } );
            res.sendCalmResponse(response.data);
        } catch ( e ) {
            next( e );
        }
    }

    /**
     * Get S3 pre-signed URL for upload
     */
    async getPresignedUrl(req, res, next) {
        try {
            const { fileName, contentType } = req.body;
            if (!fileName) {
                throw new CalmError('VALIDATION_ERROR', 'fileName is required');
            }
            const { url, key } = await this.S3Upload.getPresignedUploadUrl(fileName, {
                ACL: 'public-read',
                pathPrefix: 'uploads',
                ContentType: contentType
            });
            res.sendCalmResponse({ url, key });
        } catch (e) {
            next(e);
        }
    }

    /**
     * Save file details after client uploads to S3
     */
    async saveFileDetails(req, res, next) {
        try {
            const { originalname, mimetype, size, key } = req.body;
            if (!key) {
                throw new CalmError('VALIDATION_ERROR', 'key is required');
            }
            // Save file details in DB
            const response = await this.service.insert({
                originalname,
                mimetype,
                size,
                path: key
            });
            res.sendCalmResponse(response.data);
        } catch (e) {
            next(e);
        }
    }


    /**
     * Media Uploading Middleware
     * This can be used for any task which has media upload with other data.
     * Use this as middleware and get the file info in req.file in your router function
     * @param req
     * @param res
     * @param next
     * @returns {Promise<void>}
     */
    async insertMediaMiddleware( req, res, next ) {
        try {
            if(!req.file) {
                throw new CalmError('VALIDATION_ERROR', 'File is required');
            }
            const { key } = await this.S3Upload.uploadFile( req.file.buffer, req.file.originalname, { ACL: 'public-read', pathPrefix: 'uploads' } );
            // Modifying req.file before moving to the next
            req.file = await this.service.insert( { ...req.file, 'path': key } );
            next();
        } catch ( e ) {
            next( e );
        }
    }


    async delete( req, res, next ) {
        const { id } = req.params;

        try {
            const response = await this.service.delete( id );

            await this.S3Upload.deleteFile( response.data.path );
            res.sendCalmResponse(response.data, { deleted: true });
        } catch ( e ) {
            next( e );
        }
    }

    // ==========================
    // UPLOAD CHUNK CONTROLLER
    // ==========================
    async uploadChunk(req, res) {
        try {

            const { chunkIndex, totalChunks, fileName, uploadId } = req.body;

            if (!req.file) {
                throw new Error("Chunk file missing");
            }

            console.log(`Received chunk ${chunkIndex}/${totalChunks}`);

            if (Number(chunkIndex) === Number(totalChunks) - 1) {

                const result = await this.mergeChunks(uploadId, fileName, totalChunks);

                contactQueue.add("process-file", result);

                return res.json({
                    message: "File uploaded and merged",
                    filePath: result.filePath,
                    type: result.type
                });
            }

            return res.json({
                message: `Chunk ${chunkIndex} received`
            });

        } catch (err) {
            console.error(err);
            return res.status(500).send(err.message || "Upload failed");
        }
    }


    // ==========================
    // MERGE CHUNKS (FIXED)
    // ==========================
    async mergeChunks(uploadId, fileName, totalChunks) {

        const chunkDir = path.join(
            process.cwd(),
            "uploads/chunks",
            uploadId
        );

        const ext = path.extname(fileName);

        const finalFileName = `${uploadId}-${fileName.replace(/\.(csv|xlsx)$/, '')}${ext}`;

        const finalPath = path.join(
            process.cwd(),
            "uploads",
            finalFileName
        );

        console.log(" MERGING CHUNKS FROM:", chunkDir);

        // =========================
        //  CSV → MERGE FILE
        // =========================
        if (ext === '.csv') {

            // stream means “data is processed in small parts continuously instead of loading everything at once.”
            const writeStream = fs.createWriteStream(finalPath);

            for (let i = 0; i < totalChunks; i++) {

                const chunkPath = path.join(chunkDir, String(i));

                if (!fs.existsSync(chunkPath)) {
                    throw new Error(`Missing chunk: ${i}`);
                }

                await new Promise((resolve, reject) => {

                    const readStream = fs.createReadStream(chunkPath);

                    readStream.on("error", reject);

                    readStream.on("end", () => {
                        fs.unlinkSync(chunkPath);
                        resolve();
                    });

                    readStream.pipe(writeStream, { end: false });
                });
            }

            writeStream.end();

            await new Promise(resolve => writeStream.on("finish", resolve));

            fs.rmSync(chunkDir, { recursive: true, force: true });

            console.log("🎉 CSV MERGE COMPLETE:", finalPath);

            return { type: "csv", filePath: finalPath };
        }

        // =========================
        //  XLSX → DO NOT MERGE FILE
        // =========================
        else if (ext === '.xlsx') {

            console.log(" XLSX detected → parsing chunks instead of merging");

            const allRows = [];

            const chunks = fs.readdirSync(chunkDir).sort((a, b) => Number(a) - Number(b));

            for (const chunk of chunks) {

                const chunkPath = path.join(chunkDir, chunk);

                console.log("🔍 Parsing XLSX chunk:", chunkPath);

                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.readFile(chunkPath);

                const worksheet = workbook.worksheets[ 0 ];

                worksheet.eachRow((row, index) => {

                    if (index === 1) return; // skip header

                    allRows.push({
                        name: row.getCell(1).value,
                        email: row.getCell(2).value,
                        phone: row.getCell(3).value,
                        company: row.getCell(4).value
                    });
                });

                fs.unlinkSync(chunkPath);
            }

            fs.rmSync(chunkDir, { recursive: true, force: true });

            console.log("🎉 XLSX PARSE COMPLETE. TOTAL ROWS:", allRows.length);

            return { type: "xlsx", rows: allRows };
        }

        throw new Error("Unsupported file type");
        }


    }

module.exports = new MediaController( mediaService );

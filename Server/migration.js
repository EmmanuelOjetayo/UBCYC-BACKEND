require("dotenv").config();

const mongoose = require("mongoose");
const { Client, Databases, Query } = require("node-appwrite");
const dns = require("dns");

// ============================
// DNS CONFIGURATION
// ============================

dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

/*
|--------------------------------------------------------------------------
| ENVIRONMENT VARIABLES
|--------------------------------------------------------------------------
*/

const requiredEnv = [
    "APPWRITE_ENDPOINT",
    "APPWRITE_PROJECT_ID",
    "APPWRITE_API_KEY",
    "APPWRITE_DATABASE_ID",

    "APPWRITE_CAMPERS_COLLECTION_ID",
    "APPWRITE_MEALLOGS_COLLECTION_ID",
    "APPWRITE_PAYMENTS_COLLECTION_ID",
    "APPWRITE_SOUVENIRS_COLLECTION_ID",

    "MONGO_URL"
];

for (const key of requiredEnv) {
    if (!process.env[key]) {
        console.error(`❌ Missing environment variable: ${key}`);
        process.exit(1);
    }
}


/*
|--------------------------------------------------------------------------
| APPWRITE
|--------------------------------------------------------------------------
*/

const appwriteClient = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(appwriteClient);


/*
|--------------------------------------------------------------------------
| MONGOOSE SCHEMAS
|--------------------------------------------------------------------------
*/


/*
|--------------------------------------------------------------------------
| YCampers
|--------------------------------------------------------------------------
*/

const YCampersSchema = new mongoose.Schema({

    email: {
        type: String,
        required: true
    },

    role: {
        type: String,
        default: "user"
    },

    type: {
        type: String,
        default: "ubcyc"
    },

    name: String,

    phone: String,

    gender: String,

    password: String,

    amount_paid: Number,

    team: String,

    bus_no: String,

    bed_no: String

}, {
    timestamps: true
});


/*
|--------------------------------------------------------------------------
| Allow same email for different organizations
|
| Example:
|
| john@gmail.com + ubcyc
| john@gmail.com + gls
|
| Both are allowed.
|--------------------------------------------------------------------------
*/

YCampersSchema.index(
    {
        email: 1,
        type: 1
    },
    {
        unique: true
    }
);


const YCampers =
    mongoose.models.YCampers ||
    mongoose.model("YCampers", YCampersSchema);


/*
|--------------------------------------------------------------------------
| YCmeallog
|--------------------------------------------------------------------------
*/

const YCmeallogSchema = new mongoose.Schema({

    type: {
        type: String,
        default: "ubcyc"
    },

    meal_type: {
        type: String,
        enum: [
            "Breakfast",
            "Lunch",
            "Dinner"
        ],
        default: "Breakfast"
    },

    scanned_at: Date,

    meal_id: String,

    camperId: {
        ref: "YCampers",
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },

    day: String

}, {
    timestamps: true
});


const YCmeallog =
    mongoose.models.YCmeallog ||
    mongoose.model("YCmeallog", YCmeallogSchema);


/*
|--------------------------------------------------------------------------
| YCPayment
|--------------------------------------------------------------------------
*/

const YCPaymentSchema = new mongoose.Schema({

    camperId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "YCampers",
        required: true
    },

    type: {
        type: String,
        default: "ubcyc"
    },

    reference: String,

    date: Date,

    year: Number,

    status: {
        type: String
    },

    amount: Number

}, {
    timestamps: true
});


const YCPayment =
    mongoose.models.YCPayment ||
    mongoose.model("YCPayment", YCPaymentSchema);


/*
|--------------------------------------------------------------------------
| YCSouvenir
|--------------------------------------------------------------------------
*/

const YCSouvenirSchema = new mongoose.Schema({

    type: {
        type: String,
        default: "ubcyc"
    },

    camperId: {
        ref: "YCampers",
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },

    camperName: String,

    collected_at: Date,

    phone: String,

    level: String

}, {
    timestamps: true
});


const YCSouvenir =
    mongoose.models.YCSouvenir ||
    mongoose.model("YCSouvenir", YCSouvenirSchema);


/*
|--------------------------------------------------------------------------
| GET ALL APPWRITE DOCUMENTS
|--------------------------------------------------------------------------
*/

async function getAllDocuments(
    collectionId,
    collectionName
) {

    console.log(`\n📥 Fetching ${collectionName}...`);

    const documents = [];

    let offset = 0;

    const limit = 100;

    while (true) {

        const response =
            await databases.listDocuments(
                process.env.APPWRITE_DATABASE_ID,
                collectionId,
                [
                    Query.limit(limit),
                    Query.offset(offset)
                ]
            );

        const rows =
            response.documents || [];

        documents.push(...rows);

        console.log(
            `   ${collectionName}: ${documents.length} fetched`
        );

        if (rows.length < limit) {
            break;
        }

        offset += limit;
    }

    console.log(
        `✅ ${collectionName}: ${documents.length} total`
    );

    return documents;
}


/*
|--------------------------------------------------------------------------
| DATE HELPER
|--------------------------------------------------------------------------
*/

function convertDate(value) {

    if (!value) {
        return undefined;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return undefined;
    }

    return date;
}


/*
|--------------------------------------------------------------------------
| MAIN MIGRATION
|--------------------------------------------------------------------------
*/

async function migrate() {

    try {

        console.log("\n");
        console.log("==============================================");
        console.log("🚀 UBCYC APPWRITE → MONGODB MIGRATION");
        console.log("==============================================");
        console.log("\n");


        /*
        |--------------------------------------------------------------------------
        | CONNECT TO MONGODB
        |--------------------------------------------------------------------------
        */

        console.log("🔌 Connecting to MongoDB...");

        await mongoose.connect(
            process.env.MONGO_URL
        );

        console.log("✅ MongoDB connected");


        /*
        |--------------------------------------------------------------------------
        | FETCH APPWRITE DATA
        |--------------------------------------------------------------------------
        */

        const campers =
            await getAllDocuments(
                process.env.APPWRITE_CAMPERS_COLLECTION_ID,
                "Campers"
            );

        const payments =
            await getAllDocuments(
                process.env.APPWRITE_PAYMENTS_COLLECTION_ID,
                "Payments"
            );

        const mealLogs =
            await getAllDocuments(
                process.env.APPWRITE_MEALLOGS_COLLECTION_ID,
                "MealLogs"
            );

        const souvenirs =
            await getAllDocuments(
                process.env.APPWRITE_SOUVENIRS_COLLECTION_ID,
                "Souvenirs"
            );


        /*
        |--------------------------------------------------------------------------
        | MAP:
        |
        | Appwrite camper $id
        |
        |       ↓
        |
        | MongoDB camper _id
        |--------------------------------------------------------------------------
        */

        const camperIdMap =
            new Map();


        /*
        |--------------------------------------------------------------------------
        | MIGRATE CAMPERS
        |--------------------------------------------------------------------------
        */

        console.log("\n");
        console.log("==============================================");
        console.log("👤 MIGRATING CAMPERS");
        console.log("==============================================");


        let campersCreated = 0;
        let campersUpdated = 0;
        let campersSkipped = 0;


        for (const camper of campers) {

            try {

                if (!camper.email) {

                    console.log(
                        `⚠️ Skipping ${camper.$id}: no email`
                    );

                    campersSkipped++;

                    continue;
                }


                /*
                |--------------------------------------------------------------------------
                | Always use UBCYC
                |--------------------------------------------------------------------------
                */

                const camperType = "ubcyc";


                /*
                |--------------------------------------------------------------------------
                | Find by EMAIL + TYPE
                |--------------------------------------------------------------------------
                */

                let mongoCamper =
                    await YCampers.findOne({
                        email: camper.email,
                        type: camperType
                    });


                /*
                |--------------------------------------------------------------------------
                | DATA TO STORE
                |--------------------------------------------------------------------------
                */

                const camperData = {

                    email: camper.email,

                    role:
                        camper.role ||
                        "user",

                    type:
                        camperType,

                    name:
                        camper.name ||
                        undefined,

                    phone:
                        camper.phone ||
                        undefined,

                    gender:
                        camper.gender ||
                        undefined,

                    /*
                     * Password intentionally not migrated.
                     */

                    amount_paid:
                        typeof camper.amount_paid === "number"
                            ? camper.amount_paid
                            : 0,

                    team:
                        camper.team ||
                        undefined,

                    bus_no:
                        camper.bus_no ||
                        undefined,

                    bed_no:
                        camper.bed_no ||
                        undefined

                };


                /*
                |--------------------------------------------------------------------------
                | UPDATE EXISTING
                |--------------------------------------------------------------------------
                */

                if (mongoCamper) {

                    await YCampers.updateOne(
                        {
                            _id: mongoCamper._id
                        },
                        {
                            $set: camperData
                        }
                    );

                    campersUpdated++;

                }


                /*
                |--------------------------------------------------------------------------
                | CREATE NEW
                |--------------------------------------------------------------------------
                */

                else {

                    mongoCamper =
                        await YCampers.create(
                            camperData
                        );

                    campersCreated++;
                }


                /*
                |--------------------------------------------------------------------------
                | SAVE RELATIONSHIP
                |--------------------------------------------------------------------------
                */

                camperIdMap.set(
                    camper.$id,
                    mongoCamper._id
                );


                console.log(
                    `✅ ${camper.name || camper.email}`
                );


            } catch (error) {

                console.error(
                    `❌ Camper ${camper.$id} failed:`,
                    error.message
                );

                campersSkipped++;
            }
        }


        console.log("\n");
        console.log(
            `Created: ${campersCreated}`
        );

        console.log(
            `Updated: ${campersUpdated}`
        );

        console.log(
            `Skipped: ${campersSkipped}`
        );


        /*
        |--------------------------------------------------------------------------
        | MIGRATE PAYMENTS
        |--------------------------------------------------------------------------
        */

        console.log("\n");
        console.log("==============================================");
        console.log("💳 MIGRATING PAYMENTS");
        console.log("==============================================");


        let paymentsCreated = 0;
        let paymentsSkipped = 0;


        for (const payment of payments) {

            try {

                const mongoCamperId =
                    camperIdMap.get(
                        payment.camperId
                    );


                if (!mongoCamperId) {

                    console.log(
                        `⚠️ Payment ${payment.$id}: camper not found`
                    );

                    paymentsSkipped++;

                    continue;
                }


                await YCPayment.create({

                    camperId:
                        mongoCamperId,

                    type:
                        "ubcyc",

                    reference:
                        payment.reference ||
                        undefined,

                    date:
                        convertDate(
                            payment.date
                        ),

                    year:
                        payment.year
                            ? Number(payment.year)
                            : undefined,

                    status:
                        payment.status ||
                        undefined,

                    amount:
                        typeof payment.amount === "number"
                            ? payment.amount
                            : 0

                });


                paymentsCreated++;


            } catch (error) {

                console.error(
                    `❌ Payment ${payment.$id} failed:`,
                    error.message
                );

                paymentsSkipped++;
            }
        }


        console.log(
            `Created: ${paymentsCreated}`
        );

        console.log(
            `Skipped: ${paymentsSkipped}`
        );


        /*
        |--------------------------------------------------------------------------
        | MIGRATE MEAL LOGS
        |--------------------------------------------------------------------------
        */

        console.log("\n");
        console.log("==============================================");
        console.log("🍽️ MIGRATING MEAL LOGS");
        console.log("==============================================");


        let mealsCreated = 0;
        let mealsSkipped = 0;


        const validMealTypes = [
            "Breakfast",
            "Lunch",
            "Dinner"
        ];


        for (const meal of mealLogs) {

            try {

                const mongoCamperId =
                    camperIdMap.get(
                        meal.camperId
                    );


                if (!mongoCamperId) {

                    console.log(
                        `⚠️ MealLog ${meal.$id}: camper not found`
                    );

                    mealsSkipped++;

                    continue;
                }


                let mealType =
                    meal.meal_type ||
                    "Breakfast";


                if (
                    !validMealTypes.includes(
                        mealType
                    )
                ) {

                    mealType =
                        "Breakfast";
                }


                await YCmeallog.create({

                    type:
                        "ubcyc",

                    meal_type:
                        mealType,

                    scanned_at:
                        convertDate(
                            meal.scanned_at
                        ),

                    meal_id:
                        meal.meal_id ||
                        undefined,

                    camperId:
                        mongoCamperId,

                    day:
                        meal.day ||
                        undefined

                });


                mealsCreated++;


            } catch (error) {

                console.error(
                    `❌ MealLog ${meal.$id} failed:`,
                    error.message
                );

                mealsSkipped++;
            }
        }


        console.log(
            `Created: ${mealsCreated}`
        );

        console.log(
            `Skipped: ${mealsSkipped}`
        );


        /*
        |--------------------------------------------------------------------------
        | MIGRATE SOUVENIRS
        |--------------------------------------------------------------------------
        */

        console.log("\n");
        console.log("==============================================");
        console.log("🎁 MIGRATING SOUVENIRS");
        console.log("==============================================");


        let souvenirsCreated = 0;
        let souvenirsSkipped = 0;


        for (const souvenir of souvenirs) {

            try {

                const mongoCamperId =
                    camperIdMap.get(
                        souvenir.camperId
                    );


                if (!mongoCamperId) {

                    console.log(
                        `⚠️ Souvenir ${souvenir.$id}: camper not found`
                    );

                    souvenirsSkipped++;

                    continue;
                }


                await YCSouvenir.create({

                    type:
                        "ubcyc",

                    camperId:
                        mongoCamperId,

                    camperName:
                        souvenir.camperName ||
                        undefined,

                    collected_at:
                        convertDate(
                            souvenir.collected_at
                        ),

                    phone:
                        souvenir.phone ||
                        undefined,

                    level:
                        souvenir.level ||
                        undefined

                });


                souvenirsCreated++;


            } catch (error) {

                console.error(
                    `❌ Souvenir ${souvenir.$id} failed:`,
                    error.message
                );

                souvenirsSkipped++;
            }
        }


        /*
        |--------------------------------------------------------------------------
        | FINAL REPORT
        |--------------------------------------------------------------------------
        */

        console.log("\n\n");

        console.log("==============================================");
        console.log("🎉 MIGRATION COMPLETE");
        console.log("==============================================");

        console.log("\n📊 APPWRITE:");

        console.log(
            `Campers:    ${campers.length}`
        );

        console.log(
            `Payments:   ${payments.length}`
        );

        console.log(
            `MealLogs:   ${mealLogs.length}`
        );

        console.log(
            `Souvenirs:  ${souvenirs.length}`
        );


        console.log("\n📊 MONGODB:");

        console.log(
            `Campers created:    ${campersCreated}`
        );

        console.log(
            `Campers updated:    ${campersUpdated}`
        );

        console.log(
            `Payments created:   ${paymentsCreated}`
        );

        console.log(
            `MealLogs created:   ${mealsCreated}`
        );

        console.log(
            `Souvenirs created:  ${souvenirsCreated}`
        );


        console.log("\n🏷️ TYPE:");

        console.log(
            "All migrated records: ubcyc"
        );


        console.log("\n==============================================");
        console.log("✅ ALL DONE");
        console.log("==============================================\n");


    } catch (error) {

        console.error("\n");
        console.error("==============================================");
        console.error("❌ MIGRATION FAILED");
        console.error("==============================================");

        console.error(error);

        process.exitCode = 1;


    } finally {

        if (
            mongoose.connection.readyState !== 0
        ) {

            await mongoose.connection.close();

            console.log(
                "🔌 MongoDB connection closed."
            );
        }
    }
}


/*
|--------------------------------------------------------------------------
| START
|--------------------------------------------------------------------------
*/

migrate();
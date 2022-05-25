const express = require('express')
const app = express()
require('dotenv').config()
const jwt = require('jsonwebtoken');
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
// stripe
const stripe = require("stripe")('sk_test_51L0hCqAAAfEXZZSuMMXaKqpsynUICB7uBVnfNBZYUKnEAblVKattXrTm2eRMzKoZfWpLui2zzR0hb92E5DyQtbjN00XDLPFwby');
app.use(express.json());
app.use(cors());





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.w6dss.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


// verifyJWT function
const verifyJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UNAUTHORIZED' })
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'FORBIDDEN ACCESS' })
        }
        req.decoded = decoded;
        next();
    })
};


// run function
async function run() {
    try {
        await client.connect();
        const toolsCollection = client.db("toolsCollection").collection('tools');
        const bookingCollection = client.db("toolsCollection").collection('bookings');
        const usersCollection = client.db("toolsCollection").collection('users');
        const reviewCollection = client.db("toolsCollection").collection('reviews');
        const paymentCollection = client.db("toolsCollection").collection('payments');


        // get all tools
        app.get('/tools', async (req, res) => {
            const query = {};
            const tools = await toolsCollection.find(query).toArray();
            res.send(tools)
        })

        // add a tool to collection
        app.post('/tools', async (req, res) => {
            const product = req.body;
            console.log(product);
            const result = await toolsCollection.insertOne(product);
            res.send(result)
        });

        // find one tool with id
        app.get('/tool/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await toolsCollection.findOne(query);
            res.send(result)
        })

        // find user with id
        app.get('/user/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await usersCollection.findOne(query);
            res.send(result)
        })


        // jwt token
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updatedDoc = {
                $set: user
            };
            const result = await usersCollection.updateOne(filter, updatedDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN);
            res.send({ result, token });

        });



        // post users order
        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const result = await bookingCollection.insertOne(booking);
            res.send(result);
        });

        // get users orders
        app.get('/booking', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email === decodedEmail) {
                const query = { email: email };
                const bookings = await bookingCollection.find(query).toArray();
                return res.send(bookings);
            }
            else {
                return res.status(403), send({ message: 'FORBIDDEN ACCESS' })
            }
        });
        // get specific item by id
        app.get('/booking/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await bookingCollection.findOne(query);
            res.send(result);
        });

        // delete specific item by id

        app.delete('/booking/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await bookingCollection.deleteOne(filter);
            res.send(result);
        });

        // get all users
        app.get('/user', verifyJWT, async (req, res) => {
            const users = await usersCollection.find().toArray();
            res.send(users);
        });

        // add admin
        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAccount = await usersCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                const filter = { email: email };
                const updatedDoc = {
                    $set: { role: 'admin' }
                };
                const result = await usersCollection.updateOne(filter, updatedDoc);
                res.send(result);
            }
            else {
                res.status(403).send({ message: 'Forbidden. Admin Access Only' })
            }

        });
        // update user
        app.put('/myprofile/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const requesterAccount = await usersCollection.findOne({ email: email });
            if (requesterAccount) {
                const filter = { email: email };
                const options = { upsert: true };
                const updateDoc = {
                    $set: user
                };
                const result = await usersCollection.updateOne(filter, updateDoc, options);
                res.send(result);
            }

        })



        // get an admin from user collection and check wheather he's an admin or not
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await usersCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin });
        })


        // post review data
        app.post('/reviews', async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send(result);
        });

        // get the reviews from server
        app.get('/reviews', verifyJWT, async (req, res) => {
            const result = await reviewCollection.find().toArray();
            res.send(result)
        })


        // payment
        app.post("/create-payment-intent", verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;

            // Create a PaymentIntent with the order amount and currency
            const paymentIntent = await stripe.paymentIntents.create({
                amount,
                currency: "usd",
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        // update item payment
        app.patch('/booking/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId,
                }
            }
            const result = await paymentCollection.insertOne(payment);
            const updatedBooking = await bookingCollection.updateOne(filter, updatedDoc);

            res.send(updatedBooking)
        })


    } finally {

    }
}
run().catch(console.dir);




// APIs
app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
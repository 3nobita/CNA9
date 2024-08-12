const express = require('express');
const mongoose = require('mongoose');
const userRoutes = require('./routes/userRoutes');
const User = require('./models/User');
const Request = require('./models/Request');
const EMPTRF = require('./models/EMPTRF');
const HODTRF = require('./models/HODTRF');
const bodyParser = require('body-parser');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
require('dotenv').config();


const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 3000;

// Set view engine
app.set('view engine', 'ejs');
app.set('views', './views');

// Middleware for parsing request body
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Set up session
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key', // Change this to a secure random value
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.COOKIE_SECURE || false } // Set to true if using HTTPS
}));

// Use the user router
app.use('/api/users', userRoutes);

// Render home page
app.get('/', (req, res) => {
    res.render('index');
});

// View form to HOD
app.get('/hod/driverForm', (req, res) => {
    res.render('driverForm');
});




// Route to handle form submission
app.post('/saveBooking', (req, res) => {
    const { distance, tollUsage } = req.body;
    res.redirect('/driver/dashboard');
});

// Update form
app.post('/api/driver/updateBooking', async (req, res) => {
    const { bookingId, distanceTraveled, tollUsage } = req.body;

    try {
        const booking = await Request.findById(bookingId);
        if (!booking) {
            return res.status(404).send('Booking not found');
        }

        booking.distanceTraveled = distanceTraveled;
        booking.tollUsage = tollUsage;

        await booking.save();
        res.status(200).send('Booking updated successfully');
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// Show driver history
app.get('/driver/history', async (req, res) => {
    if (req.session.user && req.session.user.role === 'driver') {
        try {
            const bookings = await Request.find({ driverId: req.session.user.driverId });
            res.render('driverHistory', { bookings });
        } catch (err) {
            res.status(500).send('Server error');
        }
    } else {
        res.redirect('/');
    }
});



// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('MongoDB connected');

        // Check if the admin user already exists
        const existingAdmin = await User.findOne({ userId: 'admin' });
        if (!existingAdmin) {
            // Create admin user if not exists
            const adminUser = new User({
                userId: 'admin',
                name: 'Admin',
                role: 'admin',
                department: 'Administration',
                password: '123', // Store the password as plain text (not recommended for production)
            });

            await adminUser.save();
            console.log('Admin user created');

        } else {
            console.log('Admin user already exists');
        }
    })
    .catch(err => console.log('MongoDB connection error:', err));


// Start the server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});




// Login route
app.post('/api/login', async (req, res) => {
    const { userId, password } = req.body;
    const user = await User.findOne({ userId });

    if (user && user.password === password) {
        req.session.user = {
            _id: user._id,
            userId: user.userId,
            role: user.role,
            name: user.name
        };

        // Redirect based on role
        switch (user.role) {
            case 'admin':
                return res.redirect('/admin/dashboard');
            case 'driver':
                return res.redirect('/driver/dashboard');
            case 'hod':
                return res.redirect('/hod/dashboard');
            case 'employee':
                return res.redirect('/employee/dashboard');
            default:
                res.status(401).send('Invalid role');
        }
    } else {
        res.status(401).send('Invalid credentials');
    }
});

// Driver Dashboard
app.get('/driver/dashboard', async (req, res) => {
    if (req.session.user && req.session.user.role === 'driver') {
        const { startDate, endDate } = req.query;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        let dateFilter = {
            $gte: today,
            $lt: tomorrow
        };

        if (startDate && endDate) {
            dateFilter = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const query = {
            driverId: req.session.user.userId, // Filter by driverId
            date: dateFilter
        };

        try {
            const bookings = await Request.find(query);
            res.render('driverDashboard', {
                user: req.session.user,
                bookings
            });
        } catch (err) {
            res.render('driverDashboard', {
                user: req.session.user,
                bookings: []
            });
        }
    } else {
        res.redirect('/');
    }
});



// Render driver form with pre-filled driverId
app.get('/driver/form/:driverId', (req, res) => {
    const driverId = req.params.driverId;
    res.render('driverForm', { driverId });
});
// HOD dashboard route
io.on('connection', (socket) => {
    socket.on('disconnect', () => {
    });
});
// routes.js or app.js (where your routes are defined)
app.post('/api/EMP/HOD/TRF/:id/decision', async (req, res) => {
    const { id } = req.params;
    const { decision } = req.body;

    try {
        const updatedForm = await EMPTRF.findByIdAndUpdate(id, { decision: decision }, { new: true });
        res.json({ message: 'Form decision updated successfully', form: updatedForm });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/hod/decision/:id', async (req, res) => {
    if (req.session.user && req.session.user.role === 'hod') {
        try {
            const { decision } = req.body;
            await EMPTRF.findByIdAndUpdate(req.params.id, { decision, status: decision });
            res.redirect('/hod/dashboard');
        } catch (error) {
            res.redirect('/hod/dashboard');
        }
    } else {
        res.redirect('/');
    }
});
// Employee dashboard route
app.get('/employee/dashboard', async (req, res) => {
    if (req.session.user && req.session.user.role === 'employee') {
        const { startDate, endDate } = req.query;
        let query = {
            employeeCode: req.session.user.userId,
        };

        if (startDate && endDate) {
            query.dateOfRequest = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        } else {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);

            query.dateOfRequest = {
                $gte: today,
                $lt: tomorrow
            };
        }

        try {
            const emtrfs = await EMPTRF.find(query);

            res.render('employeeDashboard', {
                user: req.session.user,
                EMTRF: emtrfs,
                debug: {
                    query: JSON.stringify(query),
                    emtrfs: JSON.stringify(emtrfs, null, 2)
                }
            });
        } catch (error) {
            res.render('employeeDashboard', {
                user: req.session.user,
                EMTRF: [],
                debug: {
                    query: JSON.stringify(query),
                    emtrfs: '[]',
                    error: error.message
                }
            });
        }
    } else {
        res.redirect('/');
    }
});




// FORM to show to employee 
app.get('/employee/travel-request-form', (req, res) => {
    // Check if the user is authenticated and has the 'employee' role
    if (req.session.user && req.session.user.role === 'employee') {
        // Render the form and pass the user data
        res.render('em_TRF', {
            user: req.session.user
        });
    } else {
        // Redirect to login or another appropriate page if the user is not authenticated
        res.redirect('/login');
    }
});

// HOD Dashboard
app.get('/hod/dashboard', async (req, res) => {
    if (req.session.user && req.session.user.role === 'hod') {
        const { startDate, endDate } = req.query;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const dateFilter = startDate && endDate ? {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        } : {
            $gte: today,
            $lt: tomorrow
        };

        const queryReceived = {
            status: 'pending',
            hodId: req.session.user.userId,
            dateOfRequest: dateFilter
        };

        const querySent = {
            hodId: req.session.user.userId,
            dateOfRequest: dateFilter
        };
        
        const driverQuery = {
            dateOfRequest: dateFilter
        };

        try {
            const receivedForms = await EMPTRF.find(queryReceived);
            const sentForms = await HODTRF.find(querySent);
            const driverBookings = await Request.find(driverQuery);

            // Calculate counts
            const receivedCount = receivedForms.length;
            const sentCount = sentForms.length;
            const driverCount = driverBookings.length;

            res.render('hodDashboard', {
                user: req.session.user,
                receivedForms,
                sentForms,
                driverBookings,
                receivedCount,
                sentCount,
                driverCount
            });
        } catch (error) {
            res.render('hodDashboard', {
                user: req.session.user,
                receivedForms: [],
                sentForms: [],
                driverBookings: [],
                receivedCount: 0,
                sentCount: 0,
                driverCount: 0
            });
        }
    } else {
        res.redirect('/');
    }
});




// Save HOD form to driver in MongoDB
app.post('/api/users/hod/bookings', async (req, res) => {
    try {
        const { driverId, hodId, ...bookingData } = req.body;

        // Ensure the required fields are present
        if (!driverId) {
            return res.status(400).send('Missing required fields');
        }

        const newBooking = new Request({ 
            ...bookingData, 
            driverId, 
            hodId 
        });

        await newBooking.save();
        res.status(201).send('Booking saved successfully');
    } catch (err) {
        console.error('Error saving booking:', err);
        res.status(500).send('Server error');
    }
});



// Handle form submission and save to database
app.post('/api/EMP/HOD/TRF', async (req, res) => {
    try {
        const EMPTRFTOHOD = new EMPTRF(req.body); // Create a new instance of the EMPTRF model
        await EMPTRFTOHOD.save(); // Save the travel request to the database
        res.status(201).send('EMPTRF Req Send'); // Respond with a success message
    } catch (err) {
        res.status(500).send('Server error'); // Respond with an error message
    }
});

// Admin Dashboard

app.get('/admin/dashboard', async (req, res) => {
    if (req.session.user && req.session.user.role === 'admin') {
        let query = {};

        // Check for startDate and endDate in request query parameters
        const { startDate, endDate } = req.query;

        if (startDate && endDate) {
            query.dateOfRequest = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        } else {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);

            query.dateOfRequest = {
                $gte: today,
                $lt: tomorrow
            };
        }

        try {
            const hodtrfs = await HODTRF.find(query);

            res.render('adminDashboard', {
                user: req.session.user,
                HODTRF: hodtrfs
            });
        } catch (error) {
            res.render('adminDashboard', {
                user: req.session.user,
                HODTRF: []
            });
        }
    } else {
        res.redirect('/');
    }
});




// Endpoint to update the decision of a form by ID
app.post('/api/HOD/TRF/:id/decision', async (req, res) => {
    const { id } = req.params;
    const { decision } = req.body;

    try {
        const updatedForm = await HODTRF.findByIdAndUpdate(id, { decision: decision }, { new: true });
        res.json({ message: 'Form decision updated successfully', form: updatedForm });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/admin/decision/:id', async (req, res) => {
    if (req.session.user && req.session.user.role === 'admin') {
        try {
            const { decision } = req.body;
            await HODTRF.findByIdAndUpdate(req.params.id, { decision, status: decision });
            res.redirect('/admin/dashboard');
        } catch (error) {
            res.redirect('/admin/dashboard');
        }
    } else {
        res.redirect('/');
    }
});


// Handle form submission and save to database
app.post('/api/HOD/ADMIN/TRF', async (req, res) => {
    try {
        const HODTOADMIN = new HODTRF(req.body); // Use HODTRF model
        await HODTOADMIN.save(); // Save to HODTRF collection
        res.status(201).send('TRF Req Send'); // Success message
    } catch (err) {
        res.status(500).send('Server error'); // Error message
    }
});
app.get('/admin/hodtrfs', async (req, res) => {
    try {
        const hodtrfs = await HODTRF.find(); // Fetch all HODTRF records
        res.render('hodtrfs-list', { HODTRF: hodtrfs }); // Pass data to EJS template
    } catch (err) {
        res.status(500).send('Server error');
    }
});
app.get('/hod/TRF_ADMIN', async (req, res) => {
    if (req.session.user && req.session.user.role === 'hod') {
        res.render('hod_trf', {
            user: req.session.user,
        });
    } else {
        res.redirect('/');
    }
});

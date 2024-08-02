// models/EMPTRF.js 
const mongoose = require('mongoose');

const EMPTRFSchema = new mongoose.Schema({
    employeeCode: String,
    hodId: String,
    travellerName: String,
    mobileNo: String,
    dateOfRequest: { type: Date, default: Date.now },
    departmentName: String,
    bandDesignation: String,
    emailAddress: String,
    departureDate: Date,
    departFrom: String, 
    departureTime: String,
    arrivalTo: String,
    arrivalTime: String,
    hotelName: String,
    hotelCity: String,
    checkInDate: Date,
    checkOutDate: Date,
    nights: Number,
    location: String,
    requisitionerName: String,
    department: String,
    dateOfRequest: { type: Date, default: Date.now },
    itemDescription: String,
    quantity: Number,
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'low'
    },
    status: { type: String, default: 'pending' },
    decision: { type: String, default: null },
});

module.exports = mongoose.model('EMPTRF', EMPTRFSchema);


// Get client IP address from request object ----------------------
let getClientAddress = (req)  => {
    return (req.headers['x-forwarded-for'] || '').split(',')[0] 
    || req.connection.remoteAddress;
};


module.exports = { getClientAddress};
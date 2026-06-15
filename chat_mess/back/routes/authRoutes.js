
const express = require('express');
const router = express.Router();

const { register, login, verifyCode, verifyTwoFactor, setupTwoFactor, disableTwoFactor, getTwoFactorStatus, refresh } = require('../controllers/authController');


router.post('/register', register);


router.post('/login', login);

router.post('/verify-code', verifyCode);

router.post('/verify-two-factor', verifyTwoFactor);

router.post('/setup-two-factor', setupTwoFactor);

router.post('/disable-two-factor', disableTwoFactor);

router.get('/two-factor-status/:userId', getTwoFactorStatus);

router.post('/refresh', refresh);

module.exports = router;

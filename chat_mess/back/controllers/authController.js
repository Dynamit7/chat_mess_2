const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { User } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET || JWT_SECRET + '_refresh';

function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  }
});

const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    return res.json({ message: 'User registered successfully', userId: newUser.id });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const code = generateVerificationCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    user.verificationCode = code;
    user.verificationCodeExpires = expires;
    await user.save();

    const mailOptions = {
      from: 'My App <WelcomeDefensy@gmail.com>',
      to: user.email,
      subject: 'Ваш код подтверждения',
      text: `Ваш код подтверждения: ${code}\nОн действителен 10 минут.`,
    };
    await transporter.sendMail(mailOptions);

    return res.json({
      message: 'Verification code sent to email. Please verify.',
      userId: user.id
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error' });
  }
};

const verifyCode = async (req, res) => {
  try {
    const { userId, code } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    if (user.verificationCode !== code) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }
    if (!user.verificationCodeExpires || user.verificationCodeExpires < new Date()) {
      return res.status(400).json({ error: 'Verification code expired' });
    }

    user.verificationCode = null;
    user.verificationCodeExpires = null;
    await user.save();

    if (user.twoFactorEnabled && user.twoFactorPassword) {
      return res.json({
        message: 'Two-factor authentication required',
        requiresTwoFactor: true,
        userId: user.id
      });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ userId: user.id }, REFRESH_SECRET, { expiresIn: '30d' });

    return res.json({
      message: 'Code verified successfully',
      token,
      refreshToken,
      username: user.username,
      userId: user.id
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error' });
  }
};

const verifyTwoFactor = async (req, res) => {
  try {
    const { userId, twoFactorPassword } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    if (!user.twoFactorEnabled || !user.twoFactorPassword) {
      return res.status(400).json({ error: 'Two-factor auth is not enabled' });
    }

    const isValid = await bcrypt.compare(twoFactorPassword, user.twoFactorPassword);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid two-factor password' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ userId: user.id }, REFRESH_SECRET, { expiresIn: '30d' });

    return res.json({
      message: 'Two-factor verified successfully',
      token,
      refreshToken,
      username: user.username,
      userId: user.id
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error' });
  }
};

const setupTwoFactor = async (req, res) => {
  try {
    const { userId, password, twoFactorPassword } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid account password' });
    }

    const hashedTwoFactorPassword = await bcrypt.hash(twoFactorPassword, 10);
    user.twoFactorEnabled = true;
    user.twoFactorPassword = hashedTwoFactorPassword;
    await user.save();

    return res.json({ message: 'Two-factor authentication enabled', twoFactorEnabled: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error' });
  }
};

const disableTwoFactor = async (req, res) => {
  try {
    const { userId, password } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid account password' });
    }

    user.twoFactorEnabled = false;
    user.twoFactorPassword = null;
    await user.save();

    return res.json({ message: 'Two-factor authentication disabled', twoFactorEnabled: false });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error' });
  }
};

const getTwoFactorStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId, {
      attributes: ['id', 'twoFactorEnabled'],
    });
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    return res.json({ twoFactorEnabled: user.twoFactorEnabled });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error' });
  }
};

const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }

    const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
    const user = await User.findByPk(decoded.userId, { attributes: ['id', 'username'] });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const newToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
    const newRefreshToken = jwt.sign({ userId: user.id }, REFRESH_SECRET, { expiresIn: '30d' });

    return res.json({ token: newToken, refreshToken: newRefreshToken });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Refresh token expired' });
    }
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
};

module.exports = {
  register,
  login,
  verifyCode,
  verifyTwoFactor,
  setupTwoFactor,
  disableTwoFactor,
  getTwoFactorStatus,
  refresh,
};
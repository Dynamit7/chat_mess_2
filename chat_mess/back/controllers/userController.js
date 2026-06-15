// controllers/userController.js
const { User } = require('../models');
const { Op } = require('sequelize');

exports.updateProfile = async (req, res) => {
  try {
    const { userId } = req; 
    const { nickname } = req.body;

    
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Обновляем кличку
    user.nickname = nickname;
    await user.save();

    return res.json({ message: 'Profile updated', user });
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};


exports.searchByNickname = async (req, res) => {
    try {
      // /users/search?nickname=@myNick
      const { nickname } = req.query;
      if (!nickname) {
        return res.status(400).json({ error: 'Nickname is required' });
      }
      const clean = nickname.replace(/^@/, ''); // убираем '@' в начале
  
      const user = await User.findOne({
        where: {
          nickname: { [Op.iLike]: clean }, 
        },
        attributes: ['id', 'nickname', 'username']
      });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      return res.json({ user });
    } catch (error) {
      console.error('Error searching nickname:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  }; 
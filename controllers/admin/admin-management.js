import User from '../../models/user.model.js';
import bcrypt from 'bcrypt';

export const getAllAdmins = async (req, res) => {
    try {
        const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } });
        
        if (!admins || admins.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No admins found'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Admins retrieved successfully',
            admins
        });
    }

    catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error retrieving admins',
            error: error.message
        });
    }
}

export const addAdmin = async (req, res) => {
    try {

        const { name, email, password, role } = req.body;
        const superAdminId = req.query.adminId;
        
        if (!name || !email || !password || !role) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        if (role !== 'admin') {
            return res.status(400).json({
                success: false,
                message: 'Role must be admin'
            });
        }

        const superAdmin = await User.findById(superAdminId);

        if (!superAdmin || superAdmin.role !== 'superadmin') {
            return res.status(403).json({
                success: false,
                message: 'Only superadmin can add admins'
            });
        }

        const user = await User.findOne({ email });

        if (user) {
            return res.status(400).json({
                success: false,
                message: 'User already exists'
            });
        }

        const newUser = await new User({
            name,
            email,
            isEmailVerified: true,
            isPhoneVerified: true,
            password,
            role
        });

        newUser.password =  await bcrypt.hash(password, 10);
        await newUser.save();

        res.status(201).json({
            success: true,
            message: 'Admin added successfully',
            user: newUser
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error adding admin',
            error: error.message
        });
    }
}

export const removeAdmin = async (req, res) => {
    try {
        const adminId = req.params.id;
        const superAdminId = req.query.adminId;

        if (!adminId || !superAdminId) {
            return res.status(400).json({
                success: false,
                message: 'Admin ID is required'
            });
        }

        if (adminId === superAdminId) {
            return res.status(400).json({
                success: false,
                message: 'Cannot remove superadmin'
            });
        }

        const superAdmin = await User.findById(superAdminId);

        if (!superAdmin || superAdmin.role !== 'superadmin') {
            return res.status(403).json({
                success: false,
                message: 'Only superadmin can remove admins'
            });
        }

        const user = await User.findById(adminId);
        if (!user || user.role !== 'admin') {
            return res.status(404).json({
                success: false,
                message: 'Admin not found'
            });
        }
        if (user.role === 'superadmin') {
            return res.status(403).json({
                success: false,
                message: 'Cannot remove superadmin'
            });
        }

        await User.findByIdAndDelete(adminId);
        
        res.status(200).json({
            success: true,
            message: 'Admin removed successfully',
            user
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error removing admin',
            error: error.message
        });
    }
}

export const toggleSuspendAdmin = async (req, res) => {
    try {
        const adminId = req.params.id;

        const superAdminId = req.query.adminId;

        if (!adminId || !superAdminId) {
            return res.status(400).json({
                success: false,
                message: 'Admin ID is required'
            });
        }

        if (adminId === superAdminId) {
            return res.status(400).json({
                success: false,
                message: 'Cannot suspend superadmin'
            });
        }
        const superAdmin = await User.findById(superAdminId);

        if (!superAdmin || superAdmin.role !== 'superadmin') {
            return res.status(403).json({
                success: false,
                message: 'Only superadmin can suspend admins'
            });
        }

        const user = await User.findById(adminId);

        if (!user || user.role !== 'admin') {
            return res.status(404).json({
                success: false,
                message: 'Admin not found'
            });
        }

        if (user.role === 'superadmin') {
            return res.status(403).json({
                success: false,
                message: 'Cannot suspend superadmin'
            });
        }

        user.isSuspended = !user.isSuspended;

        await user.save();

        res.status(200).json({
            success: true,
            message: user.isSuspended ? 'Admin suspended' : 'Admin unsuspended',
            user
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error suspending admin',
            error: error.message
        });
    }
}
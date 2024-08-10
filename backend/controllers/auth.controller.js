import { User } from "../models/user.model.js";
import bcryptjs from 'bcryptjs'
import crypto from 'crypto'
import { generateVerificationToken } from "../utils/generateVerificationToken.js";
import { generateTokenAndSetCookie } from "../utils/generateTokenAndSetCookie.js";
import { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail, sendResetSuccecssEmail } from "../mailtrap/emails.js";

export const signup = async (req, res) => {
    const { email, password, name } = req.body;
    try {
        if (!email || !password || !name) {
            throw new Error("All fields are required")
        }

        const userAlreadyExist = await User.findOne({ email })

        if (userAlreadyExist) {
            return res.status(400).json({ success: false, message: 'User already exists' })
        }

        const hashedPassword = await bcryptjs.hash(password, 10)
        const verificationToken = generateVerificationToken()

        const user = await User({
            email,
            password: hashedPassword,
            name,
            verificationToken,
            verificationTokenExpiresAt: Date.now() + 24 * 60 * 60 * 10000 //24 hours
        })

        await user.save()

        //jwt
        generateTokenAndSetCookie(res, user._id)

        await sendVerificationEmail(user.email, verificationToken)
        res.status(201).json({
            success: true, message: "User created",
            user: {
                ...user._doc,
                password: undefined
            }
        })
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message })
    }
}

export const verifyEmail = async (req, res) => {
    const { code } = req.body;
    try {
        const user = await User.findOne({
            verificationToken: code,
            verificationTokenExpiresAt: { $gt: Date.now() }
        })

        if (!user) {
            return res.status(400).json({ success: false, message: "Invalid or expired verification code" })
        }

        user.isVerified = true
        user.verificationToken = undefined;
        user.verificationTokenExpiresAt = undefined
        await user.save()

        await sendWelcomeEmail(user.email, user.name)
        res.status(200).json({ success: true, message: "Email verified successfully", user: { ...user._doc, password: undefined } })
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message })
    }
}

export const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email })

        if (!user) {
            return res.status(500).json({ success: false, message: "User does't exist" })
        }

        const isPasswordCorrect = bcryptjs.compare(user.password, password)

        if (!isPasswordCorrect) {
            return res.status(500).json({ success: false, message: "Password is incorrect" })
        }

        generateTokenAndSetCookie(res, user._id)

        user.lastLogin = Date.now()
        await user.save()

        res.status(201).json({
            success: true, message: "User login",
            user: {
                ...user._doc,
                password: undefined
            }
        })
    } catch (error) {
        console.log(error);
        
        return res.status(500).json({ success: false, message: error.message })
    }
}

export const frogotPassword = async (req, res) => {
    const { email } = req.body

    try {
        const user = await User.findOne({ email })

        if (!user) {
            return res.status(500).json({ success: false, message: "User not found" })
        }

        const resetToken = crypto.randomBytes(20).toString("hex")
        const resetTokenExpirseAt = Date.now() + 1 * 60 * 60 * 1000

        user.resetPasswordToken = resetToken
        user.resetPasswordExpiresAt = resetTokenExpirseAt

        await user.save()

        // send email
        await sendPasswordResetEmail(user.email, `${process.env.CLIENT_URL}/reset-password/${resetToken}`)

        res.status(200).json({ success: true, message: "Password reset link sent to your email" })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

export const resetPassword = async (req, res) => {
    try {
        const { token } = req.params
        const { password } = req.body;

        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpiresAt: { $gt: Date.now() }
        })

        if (!user) {
            return res.status(500).json({ success: false, message: "Invalid or expired reset token" })
        }

        //update password
        const hashedPassword = await bcryptjs.hash(password, 10)

        user.password = hashedPassword
        user.resetPasswordToken = undefined;
        user.resetPasswordExpiresAt = undefined
        await user.save()

        await sendResetSuccecssEmail(user.email)
        res.status(200).json({ success: true, message: "Password reset successful" })
    } catch (error) {
        console.log(error);

        res.status(500).json({ success: false, message: error.message })
    }
}

export const checkAuth = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select("-password")

        if (!user) {
            return res.status(400).json({ success: false, message: "User not found" })
        }

        res.status(200).json({ success: true, user })
    } catch (error) {

    }
}

export const logout = async (req, res) => {
    res.clearCookie("token")
    res.status(200).json({ success: true, message: "Logged out successfully" })
}
import mongoose from "mongoose"

export const connetDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI)
        console.log("mongoDB connected");
    } catch (error) {
        console.log("Error in connected MongoDB: ", error.message);
        process.exit(1)
    }
}
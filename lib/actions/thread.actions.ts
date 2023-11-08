'use server'
import { revalidatePath } from "next/cache";
import Thread from "../models/thread.model";
import User from "../models/user.models";
import { connectToDB } from "../mongoose";
import Community from "../models/community.model";

interface params {
    text: string,
    author: string,
    communityId: string | null,
    path: string,
}

export async function createThread( { text, author, communityId, path }: params) {
    try {
        connectToDB();

    const createThread = await Thread.create({
        text,
        author,
        community: null,
    });

    //update user model
    await User.findByIdAndUpdate(author, {
        $push: { threads: createThread._id}
    })

    revalidatePath(path);
    } catch (error: any) {
        throw new Error(`Error creating thread: ${error.message}`)
    }
} 

export async function fetchPosts(pageNumber = 1, pageSize = 20) {
    connectToDB();
    //cal the number of post to skip
    const skipAmount = (pageNumber -1) * pageSize;

    //fetch post that has no parents
    const postQuery = Thread.find({ parentId: { $in: [null, undefined]}})
    .sort({ createdAt: 'desc' })
    .skip(skipAmount)
    .limit(pageSize)
    .populate({ path: 'author', model: User })
    .populate({
        path: 'children',
        populate: {
            path: 'author',
            model: User,
            select: "_id name parentId image"
        }
    })

    const totalPostCount = await Thread.countDocuments({ parentId: { $in: [null, undefined]}})

    const posts = await postQuery.exec();

    const isNext = totalPostCount > skipAmount + posts.length;
    return { posts, isNext }
}

export async function fetchThreadById(threadId: string) {
    connectToDB();
  
    try {
      const thread = await Thread.findById(threadId)
        .populate({
          path: "author",
          model: User,
          select: "_id id name image",
        }) // Populate the author field with _id and username
        .populate({
          path: "community",
          model: Community,
          select: "_id id name image",
        }) // Populate the community field with _id and name
        .populate({
          path: "children", // Populate the children field
          populate: [
            {
              path: "author", // Populate the author field within children
              model: User,
              select: "_id id name parentId image", // Select only _id and username fields of the author
            },
            {
              path: "children", // Populate the children field within children
              model: Thread, // The model of the nested children (assuming it's the same "Thread" model)
              populate: {
                path: "author", // Populate the author field within nested children
                model: User,
                select: "_id id name parentId image", // Select only _id and username fields of the author
              },
            },
          ],
        })
        .exec();
  
      return thread;
    } catch (err) {
      console.error("Error while fetching thread:", err);
      throw new Error("Unable to fetch thread");
    }
  }
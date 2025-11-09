// supabase.js

/**
 * IMPORTANT: Replace these with your Supabase Project URL and Anon Key
 */
const SUPABASE_URL = 'https://khqpcrezangyeiuvqisl.supabase.co'; // e.g., 'https://abcde12345.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocXBjcmV6YW5neWVpdXZxaXNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MTQ3NjYsImV4cCI6MjA3ODA5MDc2Nn0.Dzaqi4AN7EJgsR5j7q8NUorrjX60ufIZVWYrnmH0Z48';

// Initialize the Supabase client.
// Use a different variable name so we don't shadow the global `supabase` object
// which is provided by the CDN script. Shadowing caused a TDZ error.
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Auth Functions (Owner Only) ---

/**
 * Handles user login.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<object>} The user session data or an error object.
 */
async function login(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });
    if (error) {
        console.error('Login Error:', error.message);
        return { success: false, error: error.message };
    }
    return { success: true, data: data };
}

/**
 * Gets the current active session.
 * @returns {Promise<object|null>} The session object or null.
 */
async function getSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session;
}

/**
 * Checks if the current user is logged in.
 * @returns {Promise<boolean>} True if logged in, false otherwise.
 */
async function isLoggedIn() {
    const session = await getSession();
    return !!session;
}

/**
 * Handles user logout.
 */
async function logout() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        console.error('Logout Error:', error.message);
    }
}

// --- Database (Posts) Functions ---

/**
 * Fetches all posts, ordered by creation date (newest first).
 * @returns {Promise<Array<object>>} An array of post objects.
 */
async function fetchPosts() {
    const { data, error } = await supabaseClient
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching posts:', error);
        return [];
    }
    return data;
}

/**
 * Fetches a single post by its ID.
 * @param {number} id
 * @returns {Promise<object|null>} The post object or null.
 */
async function fetchPost(id) {
    const { data, error } = await supabaseClient
        .from('posts')
        .select('*')
        .eq('id', id)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is for "no rows found"
        console.error('Error fetching post:', error);
    }
    return data;
}

/**
 * Handles post creation.
 * @param {object} postData - { title, content, cover_image (URL), author_id }
 * @returns {Promise<object|null>} The new post data or null on error.
 */
async function createPost(postData) {
    const { data, error } = await supabaseClient
        .from('posts')
        .insert([postData])
        .select()
        .single();

    if (error) {
        console.error('Error creating post:', error);
        return null;
    }
    return data;
}

/**
 * Handles post update.
 * @param {number} id - The post ID to update.
 * @param {object} updates - The fields to update { title, content, cover_image (optional) }
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
async function updatePost(id, updates) {
    try {
        console.log('Attempting to update post:', id, 'with data:', updates);
        
        // First check if the post exists and is accessible
        const { data: existingPost, error: fetchError } = await supabaseClient
            .from('posts')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) {
            console.error('Error checking post existence:', fetchError);
            return false;
        }

        if (!existingPost) {
            console.error('Post not found or not accessible');
            return false;
        }

        // Log the existing post data for comparison
        console.log('Existing post data:', existingPost);

        // Perform the update
        const { data: updatedData, error: updateError } = await supabaseClient
            .from('posts')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            console.error('Error updating post:', updateError);
            return false;
        }

        // Log the updated data to verify changes
        console.log('Updated post data:', updatedData);
        
        // Compare the updated data with the intended updates
        const updateSuccessful = Object.keys(updates).every(key => 
            updates[key] === updatedData[key]
        );

        if (!updateSuccessful) {
            console.error('Update verification failed - some fields did not update correctly');
            console.log('Expected:', updates);
            console.log('Actual:', updatedData);
            return false;
        }

        return true;
    } catch (err) {
        console.error('Unexpected error updating post:', err);
        return false;
    }
}

/**
 * Handles post deletion.
 * @param {number} id - The post ID to delete.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
async function deletePost(id) {
    const { error } = await supabaseClient
        .from('posts')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting post:', error);
        return false;
    }
    return true;
}

/**
 * Increments the like count for a post using a Supabase SQL function.
 * @param {number} postId
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
async function incrementLikes(postId) {
    const { error } = await supabaseClient.rpc('increment_likes', { post_id: postId });

    if (error) {
        console.error('Error incrementing likes:', error);
        return false;
    }
    return true;
}

// --- Database (Comments) Functions ---

/**
 * Fetches all comments for a specific post.
 * @param {number} postId
 * @returns {Promise<Array<object>>} An array of comment objects, ordered by newest last.
 */
async function fetchComments(postId) {
    const { data, error } = await supabaseClient
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true }); // Newest last in the list view

    if (error) {
        console.error('Error fetching comments:', error);
        return [];
    }
    return data;
}

/**
 * Creates a new comment.
 * @param {object} commentData - { post_id, name, comment }
 * @returns {Promise<object|null>} The new comment data or null on error.
 */
async function createComment(commentData) {
    const { data, error } = await supabaseClient
        .from('comments')
        .insert([commentData])
        .select()
        .single();

    if (error) {
        console.error('Error creating comment:', error);
        return null;
    }
    return data;
}

// --- Storage Functions (Images) ---

/**
 * Uploads a file to Supabase Storage and returns the public URL.
 * @param {File} file - The file object from an input field.
 * @param {string} bucket - The name of the storage bucket.
 * @returns {Promise<string|null>} The public URL or null on error.
 */
async function uploadFileAndGetUrl(file) {
    const bucket = 'post-images';
    // Generate a unique file path based on a timestamp and the original file name
    const filePath = `${Date.now()}_${file.name}`;

    // Warn early if there is no active session. If your bucket has RLS policies
    // that require an authenticated user, uploads will fail with a RLS error.
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            console.warn('No active Supabase session found. Uploads to private buckets may be blocked by row-level security policies.');
        }
        const { error: uploadError } = await supabaseClient.storage
            .from(bucket)
            .upload(filePath, file);

        if (uploadError) {
            // More explicit logging to help debugging in browser console
            console.error('Error uploading file:', uploadError.message ?? uploadError);
            // If bucket doesn't exist the API returns a StorageApiError with a clear message.
            return null;
        }

        // Get the public URL.
        // getPublicUrl sometimes returns data undefined if something is wrong, so guard it.
        const { data } = supabaseClient.storage
            .from(bucket)
            .getPublicUrl(filePath);

        const publicUrl = data?.publicUrl ?? null;
        if (!publicUrl) {
            console.warn('Upload succeeded but could not get public URL for', filePath, data);
        }
        return publicUrl;
    } catch (err) {
        // Catch unexpected runtime errors and show them in console for debugging
        console.error('Unexpected error during file upload:', err);
        return null;
    }
}

/**
 * Subscribes to real-time changes on the 'posts' table.
 * @param {function} callback - Function to run when a change is detected.
 * @returns {object} The subscription channel.
 */
function subscribeToPosts(callback) {
    return supabaseClient
        .channel('public:posts')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, callback)
        .subscribe();
}

/**
 * Subscribes to real-time changes on the 'comments' table for a specific post.
 * @param {number} postId - The ID of the post to listen to.
 * @param {function} callback - Function to run when a change is detected.
 * @returns {object} The subscription channel.
 */
function subscribeToPostComments(postId, callback) {
    return supabaseClient
        .channel(`post_comments_${postId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` }, callback)
        .subscribe();
}

// Global exposure for use in other HTML pages
window.supabase = {
    login,
    logout,
    getSession,
    isLoggedIn,
    fetchPosts,
    fetchPost,
    createPost,
    updatePost,
    deletePost,
    incrementLikes,
    fetchComments,
    createComment,
    uploadFileAndGetUrl,
    subscribeToPosts,
    subscribeToPostComments,
    getUserId: async () => (await getSession())?.user.id,
    formatDate: (isoString) => new Date(isoString).toLocaleDateString()
};
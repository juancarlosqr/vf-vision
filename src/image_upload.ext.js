const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit

function createSupabaseClient({ id, key }) {
  const supabaseUrl = `https://${id}.supabase.co`;
  const supabaseAnonKey = key;

  return supabase.createClient(supabaseUrl, supabaseAnonKey);
}

const uploadImage = async (supabaseClient, bucket, file) => {
  const fileName = cleanFilename(file.name);
  const fileTimestamp = Date.now();
  const filePath = `uploads/${fileTimestamp}-${fileName}`;

  const { data, error } = await supabaseClient.storage
    .from(bucket)
    .upload(filePath, file);

  if (error) {
    console.error('Supabase upload error:', error);

    throw new Error('Error uploading image to Supabase');
  }

  return data;
};

const getPublicUrl = (supabaseClient, bucket, upload) => {
  const { data } = supabaseClient.storage
    .from(bucket)
    .getPublicUrl(upload.path);

  return data.publicUrl;
};

function cleanFilename(filename) {
  // Get the file extension if it exists
  const lastDotIndex = filename.lastIndexOf('.');
  let name = filename;
  let extension = '';

  if (lastDotIndex !== -1) {
    name = filename.substring(0, lastDotIndex);
    extension = filename.substring(lastDotIndex);
  }

  // Normalize the name part
  const normalized = name
    .toLowerCase()
    // Replace spaces and underscores with hyphens
    .replace(/[\s_]+/g, '-')
    // Remove any character that is not alphanumeric, hyphen, or period
    .replace(/[^a-z0-9\-\.]/g, '')
    // Replace multiple consecutive hyphens with a single one
    .replace(/-+/g, '-')
    // Remove hyphens from the beginning and end
    .replace(/^-+|-+$/g, '');

  // Return cleaned name with extension (if any)
  return normalized + extension;
}

function renderUploadInput({ payload }, element) {
  const { bucket } = payload;

  const supabaseClient = createSupabaseClient(payload);
  const fileUploadContainer = document.createElement('div');

  fileUploadContainer.innerHTML = `
    <style>
      .file-upload-box {
        border: 2px dashed rgba(46, 110, 225, 0.3);
        padding: 16px 32px;
        text-align: center;
        cursor: pointer;
        color: rgba(46, 110, 225, 0.6);
        font-size: 14px;
        font-family: 'Arial', sans-serif;
      }
    </style>
    <div class='file-upload-box'>Click to upload image</div>
    <input type='file' style='display: none;'>
  `;
  const fileInput = fileUploadContainer.querySelector('input[type=file]');
  const fileUploadBox = fileUploadContainer.querySelector('.file-upload-box');

  fileUploadBox.addEventListener('click', function () {
    fileInput.click();
  });

  fileInput.addEventListener('change', async function () {
    const file = fileInput.files[0];

    fileUploadContainer.innerHTML = `<img src="https://s3.amazonaws.com/com.voiceflow.studio/share/upload/upload.gif" alt="Upload" width="50" height="50">`;

    if (!file.type.includes('image')) {
      fileUploadContainer.innerHTML = `<div>File format not allowed</div>`;
      window.voiceflow.chat.interact({
        type: 'error',
      });

      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      fileUploadContainer.innerHTML = `<div>File too large (max 5MB)</div>`;
      window.voiceflow.chat.interact({
        type: 'error',
      });

      return;
    }

    try {
      const responseUpload = await uploadImage(supabaseClient, bucket, file);
      const url = getPublicUrl(supabaseClient, bucket, responseUpload);

      fileUploadContainer.innerHTML =
        '<img src="https://s3.amazonaws.com/com.voiceflow.studio/share/check/check.gif" alt="Done" width="50" height="50">';
      window.voiceflow.chat.interact({
        type: 'complete',
        payload: {
          url,
          upload: responseUpload,
        },
      });
    } catch {
      fileUploadContainer.innerHTML = `<div>Error during upload</div>`;
      window.voiceflow.chat.interact({
        type: 'error',
      });
    }
  });

  element.appendChild(fileUploadContainer);
}

const scriptElementSelector = '#vf-extension-image-upload';

export const VFImageUploadExtension = {
  name: 'FileUpload',
  type: 'response',
  match: ({ trace }) => trace.type === 'ext_image_upload',
  render: ({ trace, element }) => {
    let scriptElement = document.querySelector(scriptElementSelector);

    if (!scriptElement) {
      scriptElement = document.createElement('script');
      scriptElement.id = scriptElementSelector.replace('#', '');
      scriptElement.src = 'https://unpkg.com/@supabase/supabase-js@2';
      scriptElement.type = 'text/javascript';
      document.body.appendChild(scriptElement);

      // Wait for JS to load before using supabase
      new Promise((resolve) => (scriptElement.onload = resolve)).then(() => {
        renderUploadInput(trace, element);
      });
    } else {
      renderUploadInput(trace, element);
    }
  },
};

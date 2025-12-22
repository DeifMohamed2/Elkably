const User = require('../models/User');
const Group = require('../models/Group');
const { sendSmsMessage } = require('../utils/smsSender');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const qrcode = require('qrcode');
const Excel = require('exceljs');
const axios = require('axios'); 


const jwtSecret = process.env.JWTSECRET;

async function sendQRCode(phone, message, studentCode, centerName) {
  try {
    console.log('Sending student code via SMS for center:', centerName);

    // Extract phone number from chatId format if needed
    let phoneNumber = phone;
    if (phone.includes('@c.us')) {
      phoneNumber = phone.replace('@c.us', '');
    }
    
    // Get country code from phone or use default
    let countryCode = '20';
    if (phoneNumber.startsWith('2')) {
      countryCode = '20';
    }
    
    // Create SMS message with student code (since SMS can't send images)
    const smsMessage = `Student Code: ${studentCode}. ${message}`;
    
    // Send SMS
    const result = await sendSmsMessage(phoneNumber, smsMessage, countryCode);
    
    if (!result.success) {
      throw new Error(`Failed to send SMS: ${result.message}`);
    }

    console.log('Student code sent successfully via SMS');
    return { success: true };
  } catch (error) {
    console.error('Error sending student code via SMS:', error);
    return { success: false, error: error.message };
  }
}

// Example usage
// sendQRCode('201156012078@c.us', '313"Dasdadad13',"222","Online");


const home_page = (req, res) => {
  res.render('index', { title: 'Home Page' });
};

const public_login_get = (req, res) => {
  res.render('login', {
    title: 'Login Page',
    Email: '',
    Password: '',
    error: '',
  });
};

const public_login_post = async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;

    const user = await User.findOne({
      $or: [{ phone: emailOrPhone }],
    });

    if (!user) {
      return res
        .status(401)
        .render('login', {
          title: 'Login Page',
          Email: '',
          Password: null,
          error: 'البريد الالكتروني او كلمه المرور خاطئه',
        });
    }

    const isPasswordValid = await bcrypt.compare(password, user.Password);

    if (!isPasswordValid) {
      return res
        .status(401)
        .render('login', {
          title: 'Login Page',
          Email: '',
          Password: null,
          error: 'البريد الالكتروني او كلمه المرور خاطئه',
        });
    }

    const token = jwt.sign({ userId: user._id }, jwtSecret);
    res.cookie('token', token, { httpOnly: true });

    if (user.isTeacher) {
      return res.redirect('/teacher/dash');
    } else {
      if (user.subscribe) {
        return res.redirect('/student/dash');
      } else {
        return res.redirect('/login');
      }
    }
  } catch (error) {
    console.log(error);
    return res.status(500).redirect('/login');
  }
};

const public_Register_get = (req, res) => {
  const StudentCode = req.query.StudentCode;

  res.render('Register', {
    title: 'Login Page',
    formData: req.body,
    firebaseError: '',
    StudentCode,
  });
};

// const public_Register_post = async (req, res) => {
//   const {
//     phoneCloumnName,
//     studentPhoneCloumnName,
//     nameCloumnName,
//     centerName,
//     Grade,
//     gradeType,
//     groupTime,
//     emailCloumn,
//     schoolCloumn,
//     gradeInNumberCloumn,
//     CodeCloumn,
//     dataToSend,
//     // verificationCode,
//   } = req.body;

//   let n = 0;
//   req.io.emit('sendingMessages', {
//     nMessages: n,
//   });

//       dataToSend.forEach(async (student) => {
//         console.log(
//           'student',
//           student[phoneCloumnName],
//           student[studentPhoneCloumnName],
//           student[nameCloumnName],
//           student[emailCloumn],
//           student[schoolCloumn],
//           student[gradeInNumberCloumn],
//           student[CodeCloumn],
//           centerName,
//           Grade,
//           gradeType,
//           groupTime
//         );

//   const hashedPassword = await bcrypt.hash('1qaz2wsx', 10);

//     const user = new User({
//       Username: student[nameCloumnName],
//       Password: hashedPassword,
//       passwordWithoutHash: '1qaz2wsx',
//       Code: student[CodeCloumn],
//       phone: student[studentPhoneCloumnName],
//       parentPhone: student[phoneCloumnName],
//       gradeInNumber : student[gradeInNumberCloumn],
//       school : student[schoolCloumn],
//       email : student[emailCloumn],
//       centerName: centerName,
//       Grade: Grade,
//       gradeType: gradeType,
//       groupTime: groupTime,
//       subscribe: false,
//       balance: '100',

//       isTeacher: false,
//     });
//     console.log('done1');
//     user
//       .save()
//       .then(async (result) => {
//         await Group.findOneAndUpdate(
//           {
//             CenterName: centerName,
//             Grade: Grade,
//             gradeType: gradeType,
//             GroupTime: groupTime,
//           },
//           { $push: { students: result._id } },
//           { new: true, upsert: true }
//         )
//           .then(() => {
//             console.log('done2');
//           })
//       })


        
// })

// };
const public_Register_post = async (req, res) => {
  const {
    Username,
    Grade,
    phone,
    parentPhone,
    phoneCountryCode,
    parentPhoneCountryCode,
    centerName,
    gradeType,
    groupTime,
    balance,
    Code,
    GradeLevel,
    attendingType,
    bookTaken,
    schoolName,
  } = req.body;

  // Create an object to store validation errors
  const errors = {};

  // Phone validation is now more flexible due to different country codes
  if (!phone || phone.length < 8) {
    req.body.phone = '';
    errors.phone = '- رقم الهاتف غير صحيح';
  }

  // Parent phone validation
  if (!parentPhone || parentPhone.length < 8) {
    req.body.parentPhone = '';
    errors.parentPhone = '- رقم هاتف ولي الامر غير صحيح';
  }

  // Check if phone is equal to parentPhone
  if (phone === parentPhone) {
    // Clear the phone and parentPhone fields in the form data
    req.body.phone = '';
    req.body.parentPhone = '';

    // Set an error message for this condition
    errors.phone = '- رقم هاتف الطالب لا يجب ان يساوي رقم هاتف ولي الامر';
  }

  if (!Grade) {
    errors.Grade = '- يجب اختيار الصف الدراسي';
  }

  if (!centerName) {
    errors.centerName = '- يجب اختيار اسم center';
  }

  if (!gradeType) {
    errors.gradeType = '- يجب اختيار نوع الصف';
  }

  if (!groupTime) {
    errors.groupTime = '- يجب اختيار وقت المجموعه';
  }

  if (!balance) {
    errors.balance = '- يجب ادخال الرصيد';
  }

  if (!Code) {
    errors.Code = '- يجب ادخال كود الطالب';
  }

  if (!GradeLevel) {
    errors.GradeLevel = '- يجب ادخال المرحله الدراسيه';
  }

  if (!attendingType) {
    errors.attendingType = '- يجب ادخال نوع الحضور';
  }

  if (!schoolName) {
    errors.schoolName = '- يجب ادخال اسم المدرسه';
  }

  if (!bookTaken) {
    errors.bookTaken = '- يجب اختيار حالة استلام الكتاب';
  }

  // If there are any errors, render the form again with the errors object

  if (Object.keys(errors).length > 0) {
    return res.render('Register', {
      title: 'Register Page',
      errors: errors,
      firebaseError: '',
      formData: req.body, // Pass the form data back to pre-fill the form
    });
  }

  

  const hashedPassword = await bcrypt.hash('1qaz2wsx', 10);

  try {
    // Format phone numbers with country codes
 
    const user = new User({
      Username: Username,
      Password: hashedPassword,
      Code: Code,
      phone: phone,
      parentPhone: parentPhone,
      phoneCountryCode: phoneCountryCode || '20',
      parentPhoneCountryCode: parentPhoneCountryCode || '20',
      centerName: centerName,
      Grade: Grade,
      gradeType: gradeType,
      groupTime: groupTime,
      GradeLevel: GradeLevel,
      attendingType: attendingType,
      bookTaken: bookTaken === 'true',
      schoolName: schoolName,
      balance: balance,
    });
    user
      .save()
      .then(async (result) => {
        await Group.findOneAndUpdate(
          {
            CenterName: centerName,
            Grade: Grade,
            gradeType: gradeType,
            GroupTime: groupTime,
          },
          { $push: { students: result._id } },
          { new: true, upsert: true }
        )
          .then(async () => {
            try {
              console.log("Attempting to send QR code to student...");
              
              // Send student code via SMS
              const firstName = (Username || '').split(' ')[0];
              const studentInfo = `Student Name: ${firstName}
Code: ${Code}
Grade: ${Grade}
Level: ${GradeLevel}
Type: ${attendingType}
Book: ${bookTaken ? 'Yes' : 'No'}
School: ${schoolName}
Balance: ${balance}
Center: ${centerName}
Grade Type: ${gradeType}
Time: ${groupTime}`;
              const qrResult = await sendQRCode(
                phone,
                studentInfo,
                Code,
                centerName
              );
              
              console.log("QR code sending result:", qrResult);
              
              // Send student data to external system
              // Only send to external system if center is Online
              if (centerName === 'Online') {
                try {
                  console.log("Sending student data to external system...");
                  const externalResult = await sendStudentToExternalSystem({
                    studentName: Username,
                    studentPhone: `${phoneCountryCode || '20'}${phone}`,
                    parentPhone: `${parentPhoneCountryCode || '20'}${parentPhone}`,
                    studentCode: Code
                  });
                  
                  if (externalResult.success) {
                    console.log("Student data sent to external system successfully");
                  } else {
                    console.error("Failed to send student data to external system:", externalResult.error);
                  }
                } catch (externalError) {
                  console.error("Error sending to external system:", externalError);
                  // Don't fail the registration if external system fails
                }
              }
              res
                .status(201)
                .redirect('Register');
            } catch (qrError) {
              console.error("Failed to send QR code:", qrError);
              // Still redirect to Register even if QR code sending fails
              res
                .status(201)
                .redirect('Register');
            }
          })
          .catch((err) => {
            console.log(err);
          });
      })

      .catch((error) => {
        console.log('Error caught:', error);
        if (error.name === 'MongoServerError' && error.code === 11000) {
          const field = Object.keys(error.keyPattern)[0]; // Log the field causing the duplicate
          console.log('Duplicate field:', field); // Log the duplicate field for clarity
          if (field === 'phone') {
            errors.phone = 'هذا الرقم مستخدم من قبل';
          } else {
            errors[field] = `The ${field} is already in use.`;
          }
          res.render('Register', {
            title: 'Register Page',
            errors: errors,
            firebaseError: '',
            formData: req.body,
          });
        } else {
          console.error(error);
          res.status(500).json({ message: 'Internal Server Error' });
        }
      });

  } catch (error) {
    if (error.name === 'MongoServerError' && error.code === 11000) {
      // Duplicate key error
      errors.emailDub = 'This email is already in use.';
      // Handle the error as needed
      res.status(409).json({ message: 'User already in use' });
    } else {
      // Handle other errors
      console.error(error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  }
};

const send_verification_code = async (req, res) => {
  try {
    const { phone } = req.body;
    const code = Math.floor(Math.random() * 400000 + 600000);
    const message = `Your verification code is
${code}`;

    console.log(`Sending verification code ${code} to phone number: ${phone}`);
    
    // Get country code from request or use default (20 for Egypt)
    const countryCode = req.body.phoneCountryCode || '20';

    try {
      console.log(`Using SMS to send verification code to ${phone} with country code ${countryCode}`);
      
      // Send the message via SMS
      const response = await sendSmsMessage(phone, message, countryCode);

      if (!response.success) {
        throw new Error(`Failed to send SMS: ${response.message}`);
      }

      console.log('Verification code sent successfully via SMS');
      
      // Store the verification code and phone in the session or database
      req.session.verificationCode = code; // Assuming session middleware is used
      req.session.phone = phone;

      // Send a successful response
      res.status(201).json({ success: true, data: response.data });
    } catch (err) {
      // Handle any error that occurs during the SMS call
      console.error('Error sending verification code:', err);
      console.error('Error details:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  } catch (error) {
    console.log(error);
    res.status(500).send('Internal Server Error');
  }
};

const forgetPassword_get = (req, res) => {
  res.render('forgetPassword', {
    title: 'Forget Password',
    error: null,
    success: null,
  });
};

const forgetPassword_post = async (req, res) => {
  try {
    const { phone } = req.body;

    const user = await User.findOne({
      $or: [{ phone: phone }],
    });

    if (!user && phone) {
      res.render('forgetPassword', {
        title: 'Forget Password',
        error: 'لا يوجد حساب لهذا الايميل او رقم الهاتف',
        success: null,
      });
      return '';
    } else if (user && phone) {
      const secret = jwtSecret + user.Password;
      const token = jwt.sign({ phone: phone, _id: user._id }, secret, {
        expiresIn: '15m',
      });
      const link = `http://localhost:3000/reset-password/${user._id}/${token}`;

      // Send reset password link via SMS
      try {
        const message = `Password reset link
${link}`;
        const countryCode = '20';
        
        const response = await sendSmsMessage(phone, message, countryCode);
        
        if (!response.success) {
          throw new Error(`Failed to send SMS: ${response.message}`);
        }
        
        res.render('forgetPassword', {
          title: 'Forget Password',
          error: null,
          success: 'تم إرسال رابط إعادة تعيين كلمة المرور إلى رقم الهاتف الخاص بك',
        });
      } catch (err) {
        console.error('Error sending reset password link:', err);
        res.render('forgetPassword', {
          title: 'Forget Password',
          error: 'حدث خطأ أثناء إرسال رابط إعادة تعيين كلمة المرور',
          success: null,
        });
      }
      
      return '';
    }
  } catch (error) {
    console.log(error);
    res.status(500).send('Internal Server Error'); // Handle other errors
  }

  res.render('forgetPassword', {
    title: 'Forget Password',
    error: null,
    success: null,
  });
};

const reset_password_get = async (req, res) => {
  try {
    const { id, token } = req.params;

    const user = await User.findOne({ _id: id });
    if (!user) {
      res.send('invalid Id....');
      return;
    }
    const secret = jwtSecret + user.Password;
    const payload = jwt.verify(token, secret);
    res.render('reset-password', { phone: user.phone, error: null });
  } catch (error) {
    res.send(error.message);
  }
};

const reset_password_post = async (req, res) => {
  try {
    const { id, token } = req.params;
    const { password1, password2 } = req.body;
    const user = await User.findOne({ _id: id });
    if (!user) {
      res.send('invalid Id....');
      return;
    }
    if (password1 === password2) {
      const secret = jwtSecret + user.Password;
      const payload = jwt.verify(token, secret);
      const hashedPassword = await bcrypt.hash(password1, 10);
      await User.findByIdAndUpdate({ _id: id }, { Password: hashedPassword })
        .then(() => {
          res.redirect('/login');
        })
        .catch((error) => {
          res.send(error.message);
        });
    } else {
      res.render('reset-password', {
        phone: user.phone,
        error: 'لازم يكونو شبه بعض',
      });
    }
  } catch (error) {
    res.send(error.message);
  }
};

const create_online_student = async (req, res) => {
  try {
    const {
      Username,
      phone,
      parentPhone,
      phoneCountryCode,
      parentPhoneCountryCode,
      email,
      schoolName,
      Grade,
      GradeLevel,
      Code,
      apiKey
    } = req.body;

    // Validate API key for security
    const validApiKey = process.env.ONLINE_STUDENT_API_KEY;
    if (!apiKey || apiKey !== validApiKey) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Invalid API key' });
    }

    // Validate required fields
    if (!Username || !phone || !email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields', 
        requiredFields: ['Username', 'phone', 'email'] 
      });
    }

    // Generate a unique code for the student
    
    // Set default values for online students
    const centerName = 'Online';
    const gradeType = 'online';
    const groupTime = 'any';
    const attendingType = 'online';
    const balance = '0';
    const bookTaken = false;

    // Hash password (default password for online students)
    const hashedPassword = await bcrypt.hash('1qaz2wsx', 10);

    // Create new user
    const user = new User({
      Username: Username,
      Password: hashedPassword,
      Code: Code,
      phone: phone,
      parentPhone: parentPhone || phone,
      phoneCountryCode: phoneCountryCode || '20',
      parentPhoneCountryCode: parentPhoneCountryCode || '20',
      email: email,
      centerName: centerName,
      Grade: Grade || 'Unknown',
      gradeType: gradeType,
      groupTime: groupTime,
      GradeLevel: GradeLevel || 'Unknown',
      attendingType: attendingType,
      bookTaken: bookTaken,
      schoolName: schoolName || 'Unknown',
      balance: balance,
      subscribe: true, // Online students are automatically subscribed
      isTeacher: false,
    });

    // Save user to database
    const savedUser = await user.save();

    // Add student to the online group
    await Group.findOneAndUpdate(
      {
        CenterName: centerName,
        Grade: Grade || 'Unknown',
        gradeType: gradeType,
        GroupTime: groupTime,
      },
      { $push: { students: savedUser._id } },
      { new: true, upsert: true }
    );

    // Try to send QR code if phone number is provided
    try {
      if (phone) {
        const firstName = (Username || '').split(' ')[0];
        const studentInfo = `Welcome!
Student: ${firstName}
Code: ${Code}
Grade: ${Grade || 'Unknown'}
Level: ${GradeLevel || 'Unknown'}
Type: ${attendingType}
School: ${schoolName || 'Unknown'}
Center: ${centerName}`;
        await sendQRCode(
          phone,
          studentInfo,
          Code,
          centerName
        );
      }
    } catch (qrError) {
      console.error("Failed to send QR code:", qrError);
      // Continue with the response even if QR code sending fails
    }

    // Return success response with user data
    return res.status(201).json({
      success: true,
      message: 'Online student created successfully',
      studentData: {
        id: savedUser._id,
        username: savedUser.Username,
        code: savedUser.Code,
        phone: savedUser.phone,
        email: savedUser.email,
        centerName: savedUser.centerName,
        grade: savedUser.Grade,
      }
    });

  } catch (error) {
    console.error('Error creating online student:', error);
    
    // Handle duplicate key errors
    if (error.name === 'MongoServerError' && error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({ 
        success: false, 
        message: 'Duplicate entry', 
        field: field,
        error: `The ${field} is already in use.`
      });
    }
    
    // Handle other errors
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error', 
      error: error.message 
    });
  }
};

// =================================================== Excel Registration =================================================== //

const registerStudentsFromExcel = async (req, res) => {
  const { students } = req.body;
  
  if (!students || !Array.isArray(students) || students.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No student data provided'
    });
  }

  let successCount = 0;
  let errorCount = 0;
  const errors = [];
  const results = [];

  try {
    // Process each student
    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      
      try {
        // Validate required fields
        if (!student.Username || !student.phone || !student.parentPhone || !student.Code) {
          errors.push({
            student: student.Username || 'غير محدد',
            error: 'بيانات ناقصة: يجب إدخال الاسم ورقم الهاتف ورقم هاتف ولي الأمر والكود'
          });
          errorCount++;
          continue;
        }

        // Check if phone number already exists
        const existingPhone = await User.findOne({ phone: student.phone });
        if (existingPhone) {
          errors.push({
            student: student.Username,
            error: `رقم الهاتف ${student.phone} مستخدم بالفعل`
          });
          errorCount++;
          continue;
        }

        // Check if parent phone number already exists
        const existingParentPhone = await User.findOne({ parentPhone: student.parentPhone });
        if (existingParentPhone) {
          errors.push({
            student: student.Username,
            error: `رقم هاتف ولي الأمر ${student.parentPhone} مستخدم بالفعل`
          });
          errorCount++;
          continue;
        }

        // Check if code already exists
        const existingCode = await User.findOne({ Code: student.Code });
        if (existingCode) {
          errors.push({
            student: student.Username,
            error: `الكود ${student.Code} مستخدم بالفعل`
          });
          errorCount++;
          continue;
        }

        // Hash password (default password for Excel students)
        const hashedPassword = await bcrypt.hash('1qaz2wsx', 10);

        // Create new user
        const newUser = new User({
          Username: student.Username,
          Password: hashedPassword,
          phone: student.phone,
          parentPhone: student.parentPhone,
          phoneCountryCode: student.phoneCountryCode || '20',
          parentPhoneCountryCode: student.parentPhoneCountryCode || '20',
          Code: student.Code,
          centerName: student.centerName,
          Grade: student.Grade,
          gradeType: student.gradeType,
          groupTime: student.groupTime,
          GradeLevel: student.GradeLevel,
          attendingType: student.attendingType,
          bookTaken: student.bookTaken === 'true' || student.bookTaken === true,
          schoolName: student.schoolName,
          balance: student.balance,
          subscribe: false,
          isTeacher: false,
        });

        await newUser.save();
        
        // Add to group if group exists
        if (student.centerName && student.Grade && student.gradeType && student.groupTime) {
          let group = await Group.findOne({
            CenterName: student.centerName,
            Grade: student.Grade,
            gradeType: student.gradeType,
            GroupTime: student.groupTime
          });

          if (!group) {
            // Create new group if it doesn't exist
            group = new Group({
              CenterName: student.centerName,
              Grade: student.Grade,
              gradeType: student.gradeType,
              GroupTime: student.groupTime,
              students: []
            });
          }

          if (!group.students.includes(newUser._id)) {
            group.students.push(newUser._id);
            await group.save();
          }
        }

        // Try to send QR code if phone number is provided
        try {
          if (student.phone) {
            const firstName = (student.Username || '').split(' ')[0];
            const studentInfo = `Student: ${firstName}
Code: ${student.Code}
Grade: ${student.Grade}
Level: ${student.GradeLevel}
Type: ${student.attendingType}
Book: ${student.bookTaken ? 'Yes' : 'No'}
School: ${student.schoolName}
Balance: ${student.balance}
Center: ${student.centerName}
Grade Type: ${student.gradeType}
Time: ${student.groupTime}`;
            await sendQRCode(
              student.phone,
              studentInfo,
              student.Code,
              student.centerName
            );
          }
        } catch (qrError) {
          console.error("Failed to send QR code:", qrError);
          // Continue with the response even if QR code sending fails
        }

        successCount++;
        results.push({
          student: student.Username,
          code: student.Code,
          status: 'success'
        });

      } catch (error) {
        console.error(`Error processing student ${student.Username}:`, error);
        errors.push({
          student: student.Username || 'غير محدد',
          error: `خطأ في النظام: ${error.message}`
        });
        errorCount++;
      }
    }

    // Final response
    const response = {
      success: true,
      message: `تم معالجة ${students.length} طالب`,
      successCount,
      errorCount,
      totalProcessed: students.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Error in bulk registration:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في النظام أثناء معالجة البيانات',
      error: error.message
    });
  }
};

const exportRegistrationErrors = async (req, res) => {
  const { errors } = req.body;
  
  if (!errors || !Array.isArray(errors) || errors.length === 0) {
    return res.status(400).json({ 
      success: false, 
      message: 'No error data provided for export' 
    });
  }

  try {
    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('Registration Errors');

    // Add title
    const titleRow = worksheet.addRow(['Registration Errors Report']);
    titleRow.font = { size: 16, bold: true };
    worksheet.mergeCells('A1:B1');
    titleRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add timestamp
    worksheet.addRow(['Generated at:', new Date().toLocaleString('ar-EG')]);
    worksheet.addRow([]);

    // Add headers
    const headerRow = worksheet.addRow(['Student Name', 'Error Message']);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' }
    };

    // Add data
    errors.forEach(error => {
      worksheet.addRow([
        error.student || 'غير محدد',
        error.error || 'خطأ غير محدد'
      ]);
    });

    // Set column widths
    worksheet.columns = [
      { key: 'studentName', width: 30 },
      { key: 'errorMessage', width: 50 }
    ];

    // Add borders
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    const excelBuffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="RegistrationErrors_${new Date().toISOString().split('T')[0]}.xlsx"`
    );

    res.send(excelBuffer);

  } catch (error) {
    console.error('Error exporting registration errors to Excel:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to export errors to Excel',
      error: error.message 
    });
  }
};

// =================================================== END Excel Registration =================================================== //

// =================================================== External System API =================================================== //

// Helper function to send student data to external system
async function sendStudentToExternalSystem(studentData) {
  try {
    // Use IP address and port for VPS connection, fallback to default if not set
    // IMPORTANT: Use HTTP (not HTTPS) and include the port number
    const externalApiUrl = 'http://82.25.101.207:4091';
    const apiKey = process.env.EXTERNAL_SYSTEM_API_KEY ;

    const payload = {
      studentName: studentData.studentName,
      studentPhone: studentData.studentPhone,
      parentPhone: studentData.parentPhone,
      studentCode: studentData.studentCode,
      apiKey: apiKey
    };

    console.log('Sending student data to external system:', payload);
    console.log('External API URL:', `${externalApiUrl}/Register`);

    // Create HTTP agent that forces IPv4 to avoid IPv6 connection issues
    const http = require('http');
    const httpAgent = new http.Agent({
      family: 4, // Force IPv4
      keepAlive: true
    });

    const response = await axios.post(`${externalApiUrl}/Register`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true' // To bypass ngrok browser warning
      },
      timeout: 10000, // 10 seconds timeout
      httpAgent: httpAgent // Use IPv4 agent
    });

    console.log('External system response:', response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error sending student to external system:', error.message);
    // Don't throw error - just log it so registration can continue
    return { success: false, error: error.message };
  }
}



// =================================================== END External System API =================================================== //

module.exports = {
  home_page,
  public_login_get,
  public_Register_get,
  public_Register_post,
  send_verification_code,
  public_login_post,
  forgetPassword_get,
  forgetPassword_post,
  reset_password_get,
  reset_password_post,
  create_online_student,
  registerStudentsFromExcel,
  exportRegistrationErrors,
};

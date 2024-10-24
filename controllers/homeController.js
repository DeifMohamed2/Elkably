const User = require('../models/User');
const Group = require('../models/Group');
const waapi = require('@api/waapi');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const jwtSecret = process.env.JWTSECRET;
const waapiAPI = process.env.WAAPIAPI;
waapi.auth(`${waapiAPI}`);

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
        return res.redirect('/login?StudentCode=' + user.Code);
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

const public_Register_post = async (req, res) => {
  const {
    Username,
    Grade,
    phone,
    parentPhone,
    place,
    Password,
    centerName,
    gradeType,
    groupTime,
    balance,

    // verificationCode,
  } = req.body;

  // Create an object to store validation errors
  const errors = {};

  // // Validate verification code
  // if (req.session.verificationCode !== parseInt(verificationCode)) {
  //   errors.verificationCode = '- كود التفعيل غير صحيح';
  // }

  let Code = Math.floor(Math.random() * 400000 + 600000);

  // Check if the phone number has 11 digits
  if (phone.length !== 11) {
    req.body.phone = '';
    errors.phone = '- رقم الهاتف يجب ان يحتوي علي 11 رقم';
  }

  // Check if the parent's phone number has 11 digits
  if (parentPhone.length !== 11) {
    req.body.parentPhone = '';
    errors.parentPhone = '- رقم هاتف ولي الامر يجب ان يحتوي علي 11 رقم';
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
  // if (!ARorEN) {
  //   errors.Grade = "- يجب اختيار انت عربي ولا لغات";
  // }
  // If there are validation errors, render the registration form again with error messages
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
    const user = new User({
      Username: Username,
      Password: hashedPassword,
      passwordWithoutHash: Password,
      Code: Code,
      phone: phone,
      parentPhone: parentPhone,
      place: place,
      centerName: centerName,
      Grade: Grade,
      gradeType :gradeType , 
      groupTime: groupTime,
      subscribe: false,
      balance: balance,

      isTeacher: false,
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
          .then(() => {
            res
              .status(201)
              .redirect('Register?StudentCode=' + encodeURIComponent(Code));
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
    const message = `كود التحقق الخاص بك هو ${code}`;

    // Send the message via the waapi (already present)
    await waapi
      .postInstancesIdClientActionSendMessage(
        {
          chatId: `2${phone}@c.us`,
          message: message,
        },
        { id: '22432' }
      )

      .then(({ data }) => {
        // Store the verification code and phone in the session or database
        req.session.verificationCode = code; // Assuming session middleware is used
        req.session.phone = phone;

        // Send a successful response after setting the session
        res.status(201).json({ success: true, data });
      })
      .catch((err) => {
        // Handle any error that occurs during the waapi call
        console.error(err);
        res.status(500).json({ success: false, error: err });
      });
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

      console.log('aerd', link, postData);

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
};

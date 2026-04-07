import * as yup from 'yup';

export const registerSchema = yup
    .object({
        first_name: yup.string().required('First name is required'),
        last_name: yup.string().required('Last name is required'),
        email: yup
            .string()
            .matches(
                /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                'Please enter a valid email address',
            )
            .required('Email address is required'),
        phone_number: yup
            .string()
            .matches(/^(\+2507[8923]\d{7})$/, 'Phone must be in format +2507XXXXXXXX')
            .optional()
            .nullable()
            .transform((value) => (value === '' ? null : value)),
        password: yup
            .string()
            .min(6, 'Password must be at least 6 characters')
            .required('Password is required'),
    })
    .required();

export const loginSchema = yup
    .object({
        email: yup
            .string()
            .matches(
                /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                'Please enter a valid email address',
            )
            .required('Email address is required'),
        password: yup
            .string()
            .min(6, 'Password must be at least 6 characters')
            .required('Password is required'),
    })
    .required();

export const forgotPasswordSchema = yup
    .object({
        email: yup
            .string()
            .matches(
                /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                'Please enter a valid email address',
            )
            .required('Email address is required'),
    })
    .required();

export const resetPasswordSchema = yup
    .object({
        password: yup
            .string()
            .min(6, 'Password must be at least 6 characters')
            .required('Password is required'),
        confirmPassword: yup
            .string()
            .oneOf([yup.ref('password')], 'Passwords must match')
            .required('Please confirm your password'),
    })
    .required();

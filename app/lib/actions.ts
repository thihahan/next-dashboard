'use server';
import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { signIn } from '@/auth';
const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({ invalid_type_error: 'Please select a customer.' }),
  amount: z.coerce
    .number()
    .gt(0, { message: 'Please enter an amount greater than $0.' }),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status',
  }),
  date: z.string(),
});

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

const CreateInvoice = FormSchema.omit({ id: true, date: true });

export const createInvoice = async (prevState: State, formData: FormData) => {
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  // If form validation fails, return errors early. Otherwise, continue.
  if (!validatedFields.success) {
    console.log('errors', validatedFields.error);

    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }

  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];
  try {
    await sql`
    INSERT INTO invoices (customer_id, amount, status, date) 
    VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
  } catch (error) {
    return { message: 'Failed to create invoice' };
  }
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
};

const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export const updateInvoice = async (
  id: string,
  prevState: State,
  formData: FormData,
) => {
  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Failed to update Invoice.',
    };
  }
  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
  try {
    await sql`
    UPDATE invoices SET customer_id=${customerId}, amount=${amountInCents}, status=${status} where id=${id}
    `;
  } catch (error) {
    return { message: 'Failed to update Invoice' };
  }
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
};

export const deleteInvoice = async (id: string) => {
  try {
    await sql`
    DELETE FROM invoices WHERE id=${id}
    `;
    revalidatePath('/dashboard/invoices');

    return { message: 'Deleted invoice' };
  } catch (error) {
    return { message: 'Database Error: Failed to Delete Invoice' };
  }
};

export const authenticate = async (
  prevState: string | undefined,
  formData: FormData,
) => {
  try {
    await signIn('credentials', formData);
  } catch (e) {
    if (e instanceof AuthError) {
      switch (e.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw e;
  }
};

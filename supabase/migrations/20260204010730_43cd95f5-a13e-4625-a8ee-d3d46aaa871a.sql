-- Create carbon_budgets table to store carbon cost inputs
CREATE TABLE public.carbon_budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  scope_1_carbon_cost NUMERIC,
  scope_2_carbon_cost NUMERIC,
  scope_3_carbon_cost NUMERIC,
  discount_rate NUMERIC DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT carbon_budgets_user_unique UNIQUE (user_id)
);

-- Enable Row Level Security
ALTER TABLE public.carbon_budgets ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own carbon budgets" 
ON public.carbon_budgets 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own carbon budgets" 
ON public.carbon_budgets 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own carbon budgets" 
ON public.carbon_budgets 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own carbon budgets" 
ON public.carbon_budgets 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_carbon_budgets_updated_at
BEFORE UPDATE ON public.carbon_budgets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();